from pathlib import Path
from PIL import Image, ImageCms, PngImagePlugin
import io, struct, zlib, zipfile, json
root=Path('tests/fixtures');root.mkdir(parents=True,exist_ok=True)
profile=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
for mode in ('RGBA','P','L','RGB'):
 im=Image.new(mode,(256,192))
 if mode=='P': im.putpalette([i for x in range(256) for i in (x,255-x,x)])
 for y in range(im.height):
  for x in range(im.width):
   im.putpixel((x,y), ((x,y,120,0 if x<16 else 255) if mode=='RGBA' else (x,y,120) if mode=='RGB' else (x+y)%256))
 info=PngImagePlugin.PngInfo();info.add_text('Author','doctools fixture');info.add(b'gAMA',struct.pack('>I',45455));info.add(b'vpAg',b'preserve-unknown-safe')
 im.save(root/f'{mode}.png',compress_level=0,pnginfo=info,icc_profile=profile,dpi=(144,144))
im=Image.open(root/'RGB.png'); exif=Image.Exif();exif[274]=6
for name,options in [('photo',{}),('progressive',{'progressive':True}),('gray',{}),('cmyk',{})]:
 src=im.convert('L' if name=='gray' else 'CMYK' if name=='cmyk' else 'RGB')
 src.save(root/f'{name}.jpg',quality=93,optimize=False,exif=exif,icc_profile=profile,dpi=(144,144),**options)
a=Image.new('RGBA',(8,8),'red');b=Image.new('RGBA',(8,8),'blue');a.save(root/'animated.png',save_all=True,append_images=[b],duration=100,loop=0)
(root/'unsupported.gif').write_bytes(b'GIF89a'+b'\x01\0\x01\0')
(root/'bad.png').write_bytes(b'not a PNG')
big=bytearray((root/'RGBA.png').read_bytes());big[16:24]=struct.pack('>II',100000,100000);big[29:33]=struct.pack('>I',zlib.crc32(big[12:29]));(root/'huge.png').write_bytes(big)
print('Generated image fixtures')
