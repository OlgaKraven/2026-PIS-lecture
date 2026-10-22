# coding: utf-8
import json,re,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
from pypdf import PdfReader
out=Path('output/full-review/pdf');out.mkdir(parents=True,exist_ok=True)
c=json.load(open('course.json'));report={'pages':0,'issues':[],'lectures':[]};thumbs=[]
norm=lambda s:re.sub(r'\s+','',s)
for l in c['lectures']:
 n=l['number'];pdf=Path(f'materials/webinar-{n}.pdf');r=PdfReader(pdf)
 bbox=out/f'{n}-bbox.html';subprocess.run(['pdftotext','-bbox',str(pdf),str(bbox)],check=True)
 tree=ET.parse(bbox);pages=tree.findall('.//{http://www.w3.org/1999/xhtml}page')
 for i,p in enumerate(pages):
  w=float(p.get('width'));h=float(p.get('height'))
  for word in p.findall('{http://www.w3.org/1999/xhtml}word'):
   x0,y0,x1,y1=[float(word.get(k)) for k in ['xMin','yMin','xMax','yMax']]
   if x0 < -1 or y0 < -1 or x1 > w+1 or y1 > h+1:report['issues'].append({'lecture':n,'page':i+1,'word':word.text,'bbox':[x0,y0,x1,y1],'pageSize':[w,h]})
 texts=[norm(p.extract_text()) for p in r.pages]
 for s in l['slides']:
  if not any(norm(s['title']) in t for t in texts):report['issues'].append({'lecture':n,'missing':s['id']})
  if s.get('quiz'):
   for opt in s['quiz']['options']:
    if not any(norm(opt) in t for t in texts):report['issues'].append({'lecture':n,'missingOption':opt})
 urls=[a.get_object().get('/A',{}).get('/URI','') for p in r.pages for a in p.get('/Annots',[])]
 assert len([u for u in urls if 'mode=activity' in u])==8
 subprocess.run(['pdftoppm','-scale-to','720','-png',str(pdf),str(out/f'lecture-{n}')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 imgs=sorted(out.glob(f'lecture-{n}-*.png'));thumbs +=[(n,i+1,p) for i,p in enumerate(imgs)]
 report['lectures'].append({'lecture':n,'pages':len(r.pages),'links':len(urls)});report['pages']+=len(r.pages)
 print('PDF',n,len(r.pages),'pages rendered',flush=True)
for start in range(0,len(thumbs),40):
 chunk=thumbs[start:start+40];sheet=Image.new('RGB',(1200,8*159),'#ddd');draw=ImageDraw.Draw(sheet)
 for j,(n,p,f) in enumerate(chunk):
  x=(j%5)*240;y=(j//5)*159;im=Image.open(f);im.thumbnail((236,133));sheet.paste(im,(x,y+22));draw.text((x+4,y+4),f'L{n} PDF {p}',fill='black')
 sheet.save(out/f'contact-{start//40+1:02}.jpg')
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PDF total',report['pages'],'issues',len(report['issues']))

if report['issues']:
 raise SystemExit(1)
