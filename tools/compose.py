from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
T={'en':{
 's1':('Test wording variants on any website','Switch between text variants live – right in your real product.'),
 's2':('Original and variant, side by side','Titles, labels, buttons, placeholders and tooltips.'),
 's3':('Import from Excel, CSV or Google Sheets','Every import is validated before it goes live.'),
 's4':('See what is replaced – and what is missing','Highlight mode marks replaced, empty and unknown texts.'),
 'orig':'Original','var':'Variant “Friendly”','tile':'Text variants for UX tests'},
 'de':{
 's1':('Textvarianten auf jeder Website testen','Live zwischen Varianten wechseln – direkt im echten Produkt.'),
 's2':('Original und Variante im Vergleich','Titel, Beschriftungen, Buttons, Platzhalter und Tooltips.'),
 's3':('Import aus Excel, CSV oder Google Sheets','Jeder Import wird vor dem Übernehmen geprüft.'),
 's4':('Sehen, was ersetzt ist – und was fehlt','Der Markier-Modus zeigt ersetzte, leere und unbekannte Texte.'),
 'orig':'Original','var':'Variante «Friendly»','tile':'Textvarianten für UX-Tests'}}
BG1=(236,242,255); BG2=(222,232,252); INK=(22,30,48); MUTED=(84,96,120)
def canvas():
    im=Image.new('RGB',(1280,800),BG1); d=ImageDraw.Draw(im)
    for y in range(800):
        c=tuple(int(BG1[i]+(BG2[i]-BG1[i])*y/800) for i in range(3)); d.line([(0,y),(1280,y)],fill=c)
    return im
def shadowed(im, base, xy, radius=14):
    w,h=im.size
    sh=Image.new('RGBA',(w+60,h+60),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([30,34,30+w,34+h],radius,fill=(20,30,60,70))
    sh=sh.filter(ImageFilter.GaussianBlur(14)); base.paste(sh,(xy[0]-30,xy[1]-30),sh)
    mask=Image.new('L',(w,h),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,w-1,h-1],radius,fill=255)
    base.paste(im,xy,mask)
def head(d,title,sub):
    d.text((64,52),title,font=ImageFont.truetype(B,40),fill=INK)
    d.text((64,106),sub,font=ImageFont.truetype(R,22),fill=MUTED)
def fit(path,w):
    im=Image.open(path).convert('RGB'); return im.resize((w,int(im.height*w/im.width)),Image.LANCZOS)
for lang,tx in T.items():
    raw=f'store/raw-{lang}'; out=f'store/screenshots-{lang}'; os.makedirs(out,exist_ok=True)
    # 1 app + popup
    c=canvas(); d=ImageDraw.Draw(c); head(d,*tx['s1'])
    app=fit(f'{raw}/app-friendly.png',900); app=app.crop((0,0,900,min(app.height,610)))
    shadowed(app,c,(64,170)); pop=Image.open(f'{raw}/popup.png').convert('RGB')
    s=1.12; pop=pop.resize((int(pop.width*s),int(pop.height*s)),Image.LANCZOS); shadowed(pop,c,(1280-64-pop.width,150))
    c.save(f'{out}/1-live-variants.png')
    # 2 side by side
    c=canvas(); d=ImageDraw.Draw(c); head(d,*tx['s2'])
    for i,(f,label) in enumerate([('app-original.png',tx['orig']),('app-friendly.png',tx['var'])]):
        im=Image.open(f'{raw}/{f}').convert('RGB').crop((0,0,900,470)); im=im.resize((560,int(470*560/900)),Image.LANCZOS); x=64+i*(560+32)
        d.rounded_rectangle([x,236,x+len(label)*11+28,268],12,fill=(255,255,255) if i==0 else (31,111,235))
        d.text((x+14,242),label,font=ImageFont.truetype(B,17),fill=INK if i==0 else (255,255,255))
        shadowed(im,c,(x,290))
    c.save(f'{out}/2-side-by-side.png')
    # 3 report
    c=canvas(); d=ImageDraw.Draw(c); head(d,*tx['s3'])
    im=Image.open(f'{raw}/options-report.png').convert('RGB').crop((140,240,1140,800)); im=im.resize((1060,int(560*1.06)),Image.LANCZOS).crop((0,0,1060,588))
    shadowed(im,c,(110,170)); c.save(f'{out}/3-import-report.png')
    # 4 highlight
    c=canvas(); d=ImageDraw.Draw(c); head(d,*tx['s4'])
    im=fit(f'{raw}/app-highlight.png',1150).crop((0,0,1150,600)); shadowed(im,c,(65,170)); c.save(f'{out}/4-highlight.png')
    # promo tile 440x280
    t=Image.new('RGB',(440,280),(16,24,40)); d=ImageDraw.Draw(t)
    for y in range(280):
        d.line([(0,y),(440,y)],fill=(int(20+10*y/280),int(40+40*y/280),int(90+80*y/280)))
    ic=Image.open('ext/icons/icon128.png').convert('RGBA').resize((96,96),Image.LANCZOS); t.paste(ic,(36,50),ic)
    d.text((36,160),'Microcopy Lab',font=ImageFont.truetype(B,34),fill=(255,255,255))
    d.text((38,210),tx['tile'],font=ImageFont.truetype(R,19),fill=(205,220,255))
    t.save(f'{out}/promo-tile-440x280.png')
print('composed')
