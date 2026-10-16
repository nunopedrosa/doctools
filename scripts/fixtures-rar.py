"""Synthetic stored RAR4/RAR5 fixtures; no proprietary encoder or personal data.
RAR5 fields follow https://www.rarlab.com/technote.htm . RAR4 uses the
published RAR technical-note fixed header layout. Every header and file CRC
is computed from authored bytes and independently checked with bsdtar.
"""
from pathlib import Path
import struct,zlib,tarfile,io,subprocess
root=Path('tests/fixtures');out=root/'multiformat';out.mkdir(exist_ok=True)
pages=[('pages/001.png',(root/'textured.png').read_bytes()),('pages/002.jpg',(root/'photo.jpg').read_bytes()),('ComicInfo.xml',b'<ComicInfo><Title>Synthetic comic</Title></ComicInfo>')]
def crc(b):return zlib.crc32(b)&0xffffffff
def block4(kind,flags,body):
 h=struct.pack('<BHH',kind,flags,7+len(body))+body;return struct.pack('<H',crc(h)&65535)+h
def rar4(entries,flags=0):
 data=b'Rar!\x1a\x07\x00'+block4(0x73,flags,b'\0'*6)
 for name,payload in entries:
  n=name.encode();body=struct.pack('<IIBIIBBHI',len(payload),len(payload),3,crc(payload),1545666560,20,0x30,len(n),0o100644)+n
  data+=block4(0x74,0x8000,body)+payload
 return data+block4(0x7b,0x4000,b'')
def vint(n):
 out=bytearray()
 while n>=128:out.append((n&127)|128);n>>=7
 out.append(n);return bytes(out)
def block5(kind,flags,body,data=b''):
 h=vint(kind)+vint(flags)+(vint(len(data)) if flags&2 else b'')+body;h=vint(len(h))+h;return struct.pack('<I',crc(h))+h+data
def rar5(entries,flags=0):
 data=b'Rar!\x1a\x07\x01\x00'+block5(1,0,vint(flags))
 for name,payload in entries:
  n=name.encode();body=vint(6)+vint(len(payload))+vint(0o100644)+struct.pack('<II',1767225600,crc(payload))+vint(0)+vint(1)+vint(len(n))+n
  data+=block5(2,2,body,payload)
 return data+block5(5,0,vint(0))
for kind,build in [('rar4',rar4),('rar5',rar5)]:
 p=out/(kind+'.cbr');p.write_bytes(build(pages));names=subprocess.check_output(['bsdtar','-tf',str(p)]).decode().splitlines();assert names==[n for n,_ in pages]
 for name,data in pages:assert subprocess.check_output(['bsdtar','-xOf',str(p),name])==data
print('Stored RAR4/RAR5 authored headers, CRCs and synthetic payloads verified independently')
with tarfile.open(out/'pages.tar','w',format=tarfile.PAX_FORMAT) as t:
 for name,data in pages:
  i=tarfile.TarInfo(name);i.size=len(data);i.mtime=1767225600;i.mode=0o644;t.addfile(i,io.BytesIO(data))
with tarfile.open(out/'linked.tar','w') as t:
 i=tarfile.TarInfo('link');i.type=tarfile.SYMTYPE;i.linkname='pages/001.png';t.addfile(i)

(out/'rar4-volume.cbr').write_bytes(rar4(pages,1))
(out/'rar5-volume.cbr').write_bytes(rar5(pages,1))
(out/'small.cbr').write_bytes(rar4([('a',b'')]))
(out/'pages.cbr').write_bytes((out/'rar4.cbr').read_bytes())
(out/'pages.cbt').write_bytes((out/'pages.tar').read_bytes())
if (out/'pages.7z').exists():(out/'pages.cb7').write_bytes((out/'pages.7z').read_bytes())
