// Memory-only QPDF bridge. No page rasterization, script evaluation or filesystem APIs.
#include <qpdf/QPDF.hh>
#include <qpdf/QPDFWriter.hh>
#include <qpdf/QPDFPageDocumentHelper.hh>
#include <qpdf/QPDFCryptoProvider.hh>
#include <qpdf/QUtil.hh>
#include <qpdf/RandomDataProvider.hh>
#include <qpdf/Pipeline.hh>
#include <qpdf/JSON.hh>
#include <emscripten.h>
#include <map>
#include <set>
#include <vector>
#include <memory>
#include <string>
#include <stdexcept>
#include <algorithm>
using H=QPDFObjectHandle;
static constexpr size_t MAX=250*1024*1024;
static std::string error;
static std::string quote(std::string const&s){return JSON::makeString(s).unparse();}
static std::string id(H h){return h.getObjGen().unparse(' ');}
static void need(bool b,const char*s){if(!b)throw std::runtime_error(s);}
EM_JS(void, ds_random,(unsigned char* p,size_t n),{for(let i=0;i<n;i+=65536)globalThis.crypto.getRandomValues(HEAPU8.subarray(p+i,p+Math.min(n,i+65536)));});
class Random:public RandomDataProvider{public:void provideRandomData(unsigned char*p,size_t n)override{ds_random(p,n);}};static Random randomProvider;
class Sink:public Pipeline{
 public:size_t n=0,limit;size_t*total;bool store;std::vector<unsigned char> data;std::shared_ptr<QPDFCryptoImpl> hash;
 Sink(size_t cap,size_t*t=nullptr,bool retain=false):Pipeline("bounded-memory",nullptr),limit(cap),total(t),store(retain),hash(QPDFCryptoProvider::getImpl()){hash->SHA2_init(256);}
 void write(unsigned char const*p,size_t len)override{need(len<=limit-n,"PDF stream/output limit exceeded");if(total){need(len<=MAX-*total,"PDF cumulative decoded stream limit exceeded");*total+=len;}n+=len;hash->SHA2_update(p,len);if(store)data.insert(data.end(),p,p+len);}
 void finish()override{}
 std::string digest(){hash->SHA2_finalize();auto s=hash->SHA2_digest();std::string out;char const*hex="0123456789abcdef";for(unsigned char c:s){out+=hex[c>>4];out+=hex[c&15];}return out;}
};
struct Doc{std::string source,text;std::unique_ptr<QPDF> q;std::vector<unsigned char> result;std::map<std::string,H> objects;std::set<std::string> eligible;size_t decoded=MAX;unsigned pages=0;std::string mapping="{}";};
static std::map<int,std::unique_ptr<Doc>> docs;static int serial=0;
static Doc&get(int h){need(docs.count(h),"PDF handle is closed");return *docs.at(h);}
static bool transport(H h){return h.isStream()&&(h.getDict().getKey("/Type").isNameAndEquals("/XRef")||h.getDict().getKey("/Type").isNameAndEquals("/ObjStm"));}
static void safe(H h,int depth,size_t&nodes,bool resolve=false){
 need(depth<128&&++nodes<500000,"PDF structure limit exceeded");if(h.isIndirect()&&!resolve)return;
 if(h.isStream())h=h.getDict();
 if(h.isDictionary()){auto m=h.getDictAsMap();need(!h.getKey("/Type").isNameAndEquals("/Sig")&&!h.getKey("/FT").isNameAndEquals("/Sig")&&!h.hasKey("/ByteRange")&&!h.hasKey("/DocMDP"),"Signed PDF cannot be optimized");for(auto&kv:m)safe(kv.second,depth+1,nodes);}
 else if(h.isArray())for(int i=0;i<h.getArrayNItems();++i)safe(h.getArrayItem(i),depth+1,nodes);
}
static bool eligible(H h){if(!h.isStream())return false;auto d=h.getDict();return d.getKey("/Subtype").isNameAndEquals("/Image")&&d.getKey("/BitsPerComponent").isInteger()&&d.getKey("/BitsPerComponent").getIntValue()==8&&(d.getKey("/ColorSpace").isNameAndEquals("/DeviceRGB")||d.getKey("/ColorSpace").isNameAndEquals("/DeviceGray"))&&d.getKey("/Filter").isNameAndEquals("/DCTDecode")&&!d.hasKey("/DecodeParms")&&!d.hasKey("/Decode")&&!d.hasKey("/Mask")&&!d.hasKey("/SMask")&&!d.hasKey("/SMaskInData")&&!d.hasKey("/Alternates")&&!d.hasKey("/ImageMask");}
static void stream(H h,Sink&s,bool&filtered){need(h.pipeStreamData(&s,&filtered,0,qpdf_dl_generalized,false,false),"Invalid PDF stream encoding");}
static std::string value(H h,bool resolved,int depth,size_t&nodes){
 need(depth<128&&++nodes<500000,"PDF snapshot structure limit exceeded");
 if(h.isIndirect()&&!resolved)return "{\"ref\":"+quote(id(h))+"}";
 if(h.isStream())h=h.getDict();
 if(h.isDictionary()){std::string s="{\"dict\":{";bool first=true;for(auto&kv:h.getDictAsMap()){if(!first)s+=",";first=false;s+=quote(kv.first)+":"+value(kv.second,false,depth+1,nodes);}return s+"}}";}
 if(h.isArray()){std::string s="{\"array\":[";for(int i=0;i<h.getArrayNItems();++i){if(i)s+=",";s+=value(h.getArrayItem(i),false,depth+1,nodes);}return s+"]}";}
 return "{\"scalar\":"+quote(h.unparseBinary())+"}";
}
extern "C"{
const char*ds_pdf_error(){return error.c_str();}
int ds_pdf_open(const unsigned char*p,size_t n,unsigned objects,unsigned pages,size_t decoded){try{
 need(n<=100*1024*1024,"PDF input limit exceeded");auto d=std::make_unique<Doc>();d->source.assign((char const*)p,n);d->decoded=std::min(decoded,MAX);d->q=std::make_unique<QPDF>();d->q->setAttemptRecovery(false);d->q->setSuppressWarnings(true);d->q->processMemoryFile("local.pdf",d->source.data(),d->source.size());need(!d->q->isEncrypted(),"Encrypted PDF is not supported");auto all=d->q->getAllObjects();need(all.size()<=std::min(objects,50000u),"PDF object limit exceeded");size_t nodes=0,total=0;
 for(auto h:all){safe(h,0,nodes,true);if(!transport(h))d->objects.emplace(id(h),h);if(eligible(h))d->eligible.insert(id(h));if(h.isStream()){Sink sink(d->decoded,&total);bool filtered=false;stream(h,sink,filtered);need(total<=d->decoded,"PDF decoded stream limit exceeded");}}
 safe(d->q->getTrailer(),0,nodes,true);QPDFPageDocumentHelper helper(*d->q);helper.validate(false);d->pages=helper.getAllPages().size();need(d->pages<=std::min(pages,1000u),"PDF page limit exceeded");need(!d->q->anyWarnings(),"PDF requires repair or has unsupported warnings");int handle=++serial;docs.emplace(handle,std::move(d));return handle;
 }catch(std::exception const&e){error=e.what();return 0;}catch(...){error="PDF allocation or parser failure";return 0;}}
const char*ds_pdf_inspect(int handle){try{auto&d=get(handle);d.text="{\"pages\":"+std::to_string(d.pages)+",\"objects\":"+std::to_string(d.objects.size())+",\"images\":[";bool first=true;for(auto&kv:d.objects){auto h=kv.second;if(!h.isStream()||!h.getDict().getKey("/Subtype").isNameAndEquals("/Image"))continue;auto dict=h.getDict();if(!first)d.text+=",";first=false;auto w=dict.getKey("/Width"),hgt=dict.getKey("/Height");need(w.isInteger()&&hgt.isInteger()&&w.getIntValue()>0&&hgt.getIntValue()>0,"Invalid PDF image dimensions");Sink raw(MAX);bool rf=false;need(h.pipeStreamData(&raw,&rf,0,qpdf_dl_none),"Invalid raw PDF image");d.text+="{\"size\":"+std::to_string(raw.n)+",\"colorSpace\":"+quote(dict.getKey("/ColorSpace").unparse())+",\"objectId\":"+quote(kv.first)+",\"width\":"+std::to_string(w.getIntValue())+",\"height\":"+std::to_string(hgt.getIntValue())+",\"eligible\":"+(d.eligible.count(kv.first)?"true":"false")+",\"reason\":"+quote(d.eligible.count(kv.first)?"JPEG image":"Complex image or encoding preserved unchanged")+"}";}d.text+="],\"warnings\":[]}";return d.text.c_str();}catch(std::exception const&e){error=e.what();return nullptr;}}
const char*ds_pdf_snapshot(int handle){try{auto&d=get(handle);size_t nodes=0,total=0;d.text="{\"trailer\":"+value(d.q->getTrailer(),true,0,nodes)+",\"objects\":{";bool first=true;for(auto&kv:d.objects){if(!first)d.text+=",";first=false;d.text+=quote(kv.first)+":";auto h=kv.second;if(h.isStream()){Sink sink(d.decoded,&total);bool filtered=false;stream(h,sink,filtered);need(total<=d.decoded,"PDF decoded stream limit exceeded");d.text+="{\"stream\":"+quote(sink.digest())+",\"decoded\":"+(filtered?"true":"false")+",\"value\":"+value(h.getDict(),true,0,nodes)+"}";}else d.text+=value(h,true,0,nodes);need(d.text.size()<=32*1024*1024,"PDF snapshot size limit exceeded");}d.text+="}}";need(!d.q->anyWarnings(),"PDF stream warnings");return d.text.c_str();}catch(std::exception const&e){error=e.what();return nullptr;}}
int ds_pdf_image(int handle,const char*key){try{auto&d=get(handle);need(d.eligible.count(key),"Ineligible PDF image");Sink sink(50*1024*1024,nullptr,true);bool filtered=false;need(d.objects.at(key).pipeStreamData(&sink,&filtered,0,qpdf_dl_none),"Invalid PDF JPEG stream");d.result=std::move(sink.data);return 1;}catch(std::exception const&e){error=e.what();return 0;}}
int ds_pdf_replace(int handle,const char*key,const unsigned char*p,size_t n){try{auto&d=get(handle);need(d.eligible.count(key)&&n<=50*1024*1024,"Invalid PDF image replacement");d.objects.at(key).replaceStreamData(std::string((char const*)p,n),H::newName("/DCTDecode"),H::newNull());return 1;}catch(std::exception const&e){error=e.what();return 0;}}
int ds_pdf_write(int handle){try{auto&d=get(handle);QUtil::setRandomDataProvider(&randomProvider);Sink sink(MAX,nullptr,true);for(auto&kv:d.objects){auto h=kv.second;if(h.isStream()&&h.getDict().getKey("/Subtype").isNameAndEquals("/Image"))h.setFilterOnWrite(false);}QPDFWriter writer(*d.q);writer.setOutputPipeline(&sink);writer.setPreserveUnreferencedObjects(true);writer.setObjectStreamMode(qpdf_o_preserve);writer.setCompressStreams(true);writer.setDecodeLevel(qpdf_dl_generalized);writer.write();need(!d.q->anyWarnings(),"PDF writing warnings");d.result=std::move(sink.data);d.mapping="{";bool first=true;for(auto&kv:d.objects){if(!first)d.mapping+=",";first=false;d.mapping+=quote(kv.first)+":"+quote(writer.getRenumberedObjGen(kv.second.getObjGen()).unparse(' '));}d.mapping+="}";return 1;}catch(std::exception const&e){error=e.what();return 0;}}
const char*ds_pdf_mapping(int handle){try{return get(handle).mapping.c_str();}catch(...){return nullptr;}}
const unsigned char*ds_pdf_data(int handle){try{return get(handle).result.data();}catch(...){return nullptr;}}
size_t ds_pdf_size(int handle){try{return get(handle).result.size();}catch(...){return 0;}}
void ds_pdf_close(int handle){docs.erase(handle);}
}
