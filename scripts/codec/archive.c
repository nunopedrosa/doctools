/* In-memory libarchive bridge. No filesystem extraction and no external filters. */
#include <archive.h>
#include <archive_entry.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <locale.h>
#define ENTRY_MAX (50u*1024u*1024u)
#define TOTAL_MAX (250u*1024u*1024u)
typedef struct {struct archive *a;int writer,finished,entry_open;struct archive_entry *entry;unsigned char chunk[65536],*out;size_t len,cap,total,entry_bytes,expected;char *json;char error[512];} Arc;
static char last_error[512];
static int fail(Arc*h,const char*s){snprintf(h?h->error:last_error,512,"%s",s?s:"Archive processing failed");return -1;}
const char *ds_arc_error(Arc*h){return h?h->error:last_error;}
Arc *ds_arc_open(const void *ptr,size_t len,int format){
 setlocale(LC_ALL,"C.UTF-8");Arc*h=calloc(1,sizeof(Arc));if(!h){fail(NULL,"Archive memory limit reached");return NULL;}
 h->a=archive_read_new();if(!h->a){free(h);fail(NULL,"Archive allocation failed");return NULL;}
 archive_read_support_filter_none(h->a);
 if(format==1)archive_read_support_format_tar(h->a);else if(format==2)archive_read_support_format_7zip(h->a);else if(format==3){archive_read_support_format_rar(h->a);archive_read_support_format_rar5(h->a);}else{archive_read_free(h->a);free(h);fail(NULL,"Unsupported archive format");return NULL;}
 int r=archive_read_open_memory(h->a,ptr,len);if(r!=ARCHIVE_OK){fail(NULL,archive_error_string(h->a));archive_read_free(h->a);free(h);return NULL;}return h;
}
static char *quote(const char*s){if(!s)s="";size_t n=strlen(s);if(n>65535)return NULL;char*out=malloc(n*6+3),*p=out;if(!out)return NULL;*p++='"';for(const unsigned char*q=(const unsigned char*)s;*q;q++){unsigned c=*q;if(c=='"'||c=='\\'){*p++='\\';*p++=(char)c;}else if(c<32){snprintf(p,7,"\\u%04x",c);p+=6;}else *p++=(char)c;}*p++='"';*p=0;return out;}
int ds_arc_next(Arc*h){
 free(h->json);h->json=NULL;int r=archive_read_next_header(h->a,&h->entry);if(r==ARCHIVE_EOF){if(archive_read_has_encrypted_entries(h->a)>0)return fail(h,"Encrypted archives are not supported");return 0;}if(r!=ARCHIVE_OK)return fail(h,archive_error_string(h->a));
 struct archive_entry*e=h->entry;int type=archive_entry_filetype(e);if(archive_entry_is_encrypted(e)>0)return fail(h,"Encrypted archive entries are not supported");
 if((type!=AE_IFREG&&type!=AE_IFDIR)||archive_entry_hardlink(e)||archive_entry_symlink(e))return fail(h,"Archive links and special files are not supported");
 if(archive_entry_sparse_count(e)||archive_entry_xattr_count(e)||archive_entry_acl_count(e,ARCHIVE_ENTRY_ACL_TYPE_ACCESS|ARCHIVE_ENTRY_ACL_TYPE_DEFAULT|ARCHIVE_ENTRY_ACL_TYPE_NFS4))return fail(h,"Unsupported archive sparse, ACL or extended metadata");
 unsigned long set=0,clear=0;archive_entry_fflags(e,&set,&clear);if(set||clear)return fail(h,"Unsupported archive file flags");
 int64_t size=archive_entry_size(e);if(size<0||size>ENTRY_MAX)return fail(h,"Expanded entry limit exceeded");
 h->entry_bytes=0;h->expected=(size_t)size;
 const char*name=archive_entry_pathname_utf8(e);if(!name)name=archive_entry_pathname(e);
 char*n=quote(name),*u=quote(archive_entry_uname(e)),*g=quote(archive_entry_gname(e));if(!n||!u||!g){free(n);free(u);free(g);return fail(h,"Archive name or memory limit exceeded");}
 size_t cap=strlen(n)+strlen(u)+strlen(g)+1500;h->json=malloc(cap);if(!h->json){free(n);free(u);free(g);return fail(h,"Archive memory limit reached");}
 int times=(archive_entry_mtime_is_set(e)?1:0)|(archive_entry_atime_is_set(e)?2:0)|(archive_entry_ctime_is_set(e)?4:0)|(archive_entry_birthtime_is_set(e)?8:0);
 snprintf(h->json,cap,"{\"name\":%s,\"size\":%lld,\"directory\":%s,\"mode\":%u,\"uid\":%lld,\"gid\":%lld,\"uname\":%s,\"gname\":%s,\"mtime\":%.0f,\"mtimeNs\":%ld,\"atime\":%.0f,\"atimeNs\":%ld,\"ctime\":%.0f,\"ctimeNs\":%ld,\"birthtime\":%.0f,\"birthtimeNs\":%ld,\"times\":%d}",n,(long long)size,type==AE_IFDIR?"true":"false",archive_entry_mode(e),(long long)archive_entry_uid(e),(long long)archive_entry_gid(e),u,g,(double)archive_entry_mtime(e),archive_entry_mtime_nsec(e),(double)archive_entry_atime(e),archive_entry_atime_nsec(e),(double)archive_entry_ctime(e),archive_entry_ctime_nsec(e),(double)archive_entry_birthtime(e),archive_entry_birthtime_nsec(e),times);free(n);free(u);free(g);return 1;
}
const char*ds_arc_entry_json(Arc*h){return h->json;}
int ds_arc_read_chunk(Arc*h){
 la_ssize_t r=archive_read_data(h->a,h->chunk,sizeof(h->chunk));if(r<0)return fail(h,archive_error_string(h->a));
 if((size_t)r>ENTRY_MAX-h->entry_bytes||(size_t)r>TOTAL_MAX-h->total)return fail(h,"Expanded archive byte limit exceeded");h->entry_bytes+=(size_t)r;h->total+=(size_t)r;
 if(!r&&h->entry_bytes!=h->expected)return fail(h,"Archive expanded size mismatch");return (int)r;
}
const void*ds_arc_chunk_data(Arc*h){return h->chunk;}
static la_ssize_t write_out(struct archive*a,void*client,const void*data,size_t len){
 Arc*h=client;if(len>TOTAL_MAX-h->len){archive_set_error(a,1,"Archive output limit exceeded");return -1;}
 if(h->len+len>h->cap){size_t cap=h->cap?h->cap:65536;while(cap<h->len+len){cap*=2;if(cap>TOTAL_MAX){cap=TOTAL_MAX;break;}}unsigned char*p=realloc(h->out,cap);if(!p){archive_set_error(a,1,"Archive memory limit reached");return -1;}h->out=p;h->cap=cap;}
 memcpy(h->out+h->len,data,len);h->len+=len;return (la_ssize_t)len;
}
Arc*ds_arc_writer_open(int format){
 Arc*h=calloc(1,sizeof(Arc));if(!h){fail(NULL,"Archive memory limit reached");return NULL;}h->writer=1;h->a=archive_write_new();int r;
 if(format==1)r=archive_write_set_format_pax_restricted(h->a);else if(format==2)r=archive_write_set_format_7zip(h->a);else r=ARCHIVE_FATAL;
 if(r==ARCHIVE_OK)r=archive_write_add_filter_none(h->a);if(r==ARCHIVE_OK)r=archive_write_set_bytes_per_block(h->a,0);if(r==ARCHIVE_OK)r=archive_write_open(h->a,h,NULL,write_out,NULL);
 if(r!=ARCHIVE_OK){fail(NULL,archive_error_string(h->a));archive_write_free(h->a);free(h);return NULL;}return h;
}
static int finish_entry(Arc*h){if(!h->entry_open)return 0;if(h->entry_bytes!=h->expected)return fail(h,"Archive writer size mismatch");int r=archive_write_finish_entry(h->a);h->entry_open=0;if(r!=ARCHIVE_OK)return fail(h,archive_error_string(h->a));return 0;}
int ds_arc_writer_header(Arc*h,const char*name,double size,int mode,double uid,double gid,const char*uname,const char*gname,int times,double mt,int mn,double at,int an,double ct,int cn,double bt,int bn){
 if(finish_entry(h))return -1;if(size<0||size>ENTRY_MAX)return fail(h,"Expanded entry limit exceeded");struct archive_entry*e=archive_entry_new();if(!e)return fail(h,"Archive memory limit reached");
 archive_entry_set_pathname_utf8(e,name);archive_entry_set_size(e,(la_int64_t)size);archive_entry_set_mode(e,mode);archive_entry_set_uid(e,(la_int64_t)uid);archive_entry_set_gid(e,(la_int64_t)gid);if(*uname)archive_entry_set_uname(e,uname);if(*gname)archive_entry_set_gname(e,gname);
 if(times&1)archive_entry_set_mtime(e,(time_t)mt,mn);if(times&2)archive_entry_set_atime(e,(time_t)at,an);if(times&4)archive_entry_set_ctime(e,(time_t)ct,cn);if(times&8)archive_entry_set_birthtime(e,(time_t)bt,bn);
 int r=archive_write_header(h->a,e);archive_entry_free(e);if(r!=ARCHIVE_OK)return fail(h,archive_error_string(h->a));h->entry_bytes=0;h->expected=(size_t)size;h->entry_open=1;return 0;
}
int ds_arc_writer_chunk(Arc*h,const void*ptr,size_t size){size_t done=0;if(size>h->expected-h->entry_bytes)return fail(h,"Archive writer size exceeded");while(done<size){la_ssize_t r=archive_write_data(h->a,(const unsigned char*)ptr+done,size-done);if(r<=0)return fail(h,archive_error_string(h->a));done+=(size_t)r;}h->entry_bytes+=size;return 0;}
int ds_arc_writer_finish(Arc*h){if(finish_entry(h))return -1;int r=archive_write_close(h->a);h->finished=1;if(r!=ARCHIVE_OK)return fail(h,archive_error_string(h->a));return 0;}
const void*ds_arc_result_data(Arc*h){return h->out;}
size_t ds_arc_result_size(Arc*h){return h->len;}
void ds_arc_close(Arc*h){if(!h)return;if(h->writer)archive_write_free(h->a);else archive_read_free(h->a);free(h->json);free(h->out);free(h);}

/* libarchive's 7z writer needs seekable scratch storage. Its translation unit
 * is compiled with the five tempfile calls mapped here, keeping FILESYSTEM=0.
 * These handles are private memory buffers, not OS descriptors or browser files.
 */
#include <errno.h>
#include <sys/types.h>
#include <unistd.h>
typedef struct {unsigned char *data;size_t len,cap,pos;int used;} Scratch;
static Scratch scratch[16];static size_t scratch_capacity;
static Scratch*scratch_for(int fd){int i=fd-10000;if(i<0||i>=16||!scratch[i].used){errno=EBADF;return NULL;}return &scratch[i];}
int ds_tmp_create(const char*dir){(void)dir;for(int i=0;i<16;i++)if(!scratch[i].used){memset(&scratch[i],0,sizeof(Scratch));scratch[i].used=1;return 10000+i;}errno=EMFILE;return -1;}
ssize_t ds_tmp_write(int fd,const void*buf,size_t n){Scratch*s=scratch_for(fd);if(!s)return -1;if(s->pos>TOTAL_MAX||n>TOTAL_MAX-s->pos){errno=EFBIG;return -1;}size_t end=s->pos+n;
 if(end>s->cap){size_t cap=s->cap?s->cap:65536;while(cap<end){cap*=2;if(cap>TOTAL_MAX){cap=TOTAL_MAX;break;}}if(cap-s->cap>TOTAL_MAX-scratch_capacity){errno=EFBIG;return -1;}unsigned char*p=realloc(s->data,cap);if(!p){errno=ENOMEM;return -1;}scratch_capacity+=cap-s->cap;s->data=p;s->cap=cap;}
 if(s->pos>s->len)memset(s->data+s->len,0,s->pos-s->len);memcpy(s->data+s->pos,buf,n);s->pos=end;if(end>s->len)s->len=end;return (ssize_t)n;
}
ssize_t ds_tmp_read(int fd,void*buf,size_t n){Scratch*s=scratch_for(fd);if(!s)return -1;if(s->pos>=s->len)return 0;if(n>s->len-s->pos)n=s->len-s->pos;memcpy(buf,s->data+s->pos,n);s->pos+=n;return (ssize_t)n;}
off_t ds_tmp_seek(int fd,off_t offset,int whence){Scratch*s=scratch_for(fd);if(!s)return -1;off_t base=whence==SEEK_SET?0:whence==SEEK_CUR?(off_t)s->pos:whence==SEEK_END?(off_t)s->len:-1;if(base<0||offset<-(off_t)base||offset>(off_t)TOTAL_MAX-base){errno=EINVAL;return -1;}s->pos=(size_t)(base+offset);return (off_t)s->pos;}
int ds_tmp_close(int fd){Scratch*s=scratch_for(fd);if(!s)return -1;scratch_capacity-=s->cap;free(s->data);memset(s,0,sizeof(*s));return 0;}
