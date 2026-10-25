"""End-to-end API checks against an isolated local test instance, never production."""
import base64
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

origin=os.environ.get('SMOKE_URL','http://127.0.0.1:18767').rstrip('/')
if not origin.startswith(('http://127.0.0.1:','http://localhost:')):
    raise SystemExit('Run these mutation checks only against an isolated localhost instance.')
password=os.environ['SMOKE_PASSWORD']
email=os.environ['SMOKE_EMAIL']
token=''
def call(path, method='GET', body=None, status=200, headers=None):
    merged={'Authorization':'Bearer '+token} if token else {}
    merged.update(headers or {})
    if isinstance(body,dict):body=json.dumps(body).encode();merged['Content-Type']='application/json'
    request=urllib.request.Request(origin+path,data=body,method=method,headers=merged)
    try:
        response=urllib.request.urlopen(request,timeout=180)
        code=response.status;raw=response.read();kind=response.headers.get('Content-Type','')
    except urllib.error.HTTPError as error:
        code=error.code;raw=error.read();kind=error.headers.get('Content-Type','')
    assert code==status,(method,path,code,raw[:300])
    return json.loads(raw) if 'application/json' in kind else raw

call('/api/admin/content',status=401)
call('/api/admin/login','POST',{'email':email,'password':'invalid'},status=401)
token=call('/api/admin/login','POST',{'email':email,'password':password})['token']
content=call('/api/admin/content');schema=call('/api/admin/schema')
assert set(content)==set(schema)
call('/api/admin/content',headers={'Origin':'https://untrusted.example'},status=403)

def upload(payload,name):
    boundary='PortfolioSmokeBoundary'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()+payload+f'\r\n--{boundary}--\r\n'.encode())
    return body,{'Content-Type':'multipart/form-data; boundary='+boundary}
body,headers=upload(b'<html>not an image</html>','invalid.png')
call('/api/admin/uploads','POST',body,status=400,headers=headers)
image=Path(__file__).resolve().parents[2]/'frontend/images/fr.png'
body,headers=upload(image.read_bytes(),'portrait.png')
asset=call('/api/admin/uploads','POST',body,headers=headers)['path']
assert call('/media/'+asset).startswith(b'\x89PNG')

profile=content['profile'].copy();profile['introduction']='Isolated API preview verification.';profile['about_photo']=asset
call('/api/admin/content/profile','PUT',profile)
assert b'Isolated API preview verification.' in call('/api/public/page')
call('/api/admin/content/profile','PUT',content['profile'])

for name in ['contact','skills','education','experience','achievements','resume','site-settings','reviews']:
    call('/api/admin/content/'+name,'PUT',content[name])

for collection in ['projects','papers']:
    record={'id':'isolated-smoke-record','title':'Isolated smoke record','published':True,'thumbnail':asset}
    if collection=='papers':record.update(authors=['Test author'],topics=['Machine Learning','Edge AI'],doi='10.1000/test',publication_type='Journal Article',peer_reviewed=True,publication_date='25 October 2026',year='2026',button_label='Read paper')
    path='/api/admin/content/'+collection+'/'+record['id']
    call(path,'POST',record)
    assert b'Isolated smoke record' in call('/api/public/page')
    record['title']='Edited isolated record';call(path,'PUT',record)
    assert b'Edited isolated record' in call('/api/public/page')
    record['published']=False;call(path,'PUT',record)
    assert b'Edited isolated record' not in call('/api/public/page')
    call(path,'DELETE')
    assert all(item['id']!=record['id'] for item in call('/api/admin/content')[collection])

bad={'id':'bad-record','title':'Bad record','paper_url':'javascript:alert(1)'}
call('/api/admin/content/papers/bad-record','POST',bad,status=422)
assert b'Bad record' not in call('/api/public/page')
assert call('/api/admin/export').startswith(b'PK')
call('/api/admin/logout','POST')
call('/api/admin/content',status=401)
print('Passed: authentication; CORS; signed-in uploads; all editable sections; project/paper create, edit, hide and delete; public refresh; validation rollback; ZIP export; logout invalidation.')
