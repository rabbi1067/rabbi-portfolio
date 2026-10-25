(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const raw=(window.PORTFOLIO_CONFIG||{}).apiBase||'';
  const api=raw==='same-origin'?location.origin:raw.replace(/\/$/,'');
  const collections=new Set(['projects','research','papers']);
  const labels={profile:'Home & About','site-settings':'Site settings',projects:'Projects',skills:'Skills & Tools',education:'Education',experience:'Experience',papers:'Research papers',research:'Research projects',achievements:'Certifications & Awards',reviews:'Reviews',contact:'Contact',resume:'CV & resume'};
  let token=sessionStorage.getItem('portfolio-admin-token')||'',data={},schema={},section='profile',recordId=null,isNew=false,readEditor=null,dirty=false;
  function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').hidden=!text;}
  async function request(path,options={}){
    const headers={...(token?{Authorization:'Bearer '+token}:{}),...options.headers};
    if(options.body && !(options.body instanceof FormData))headers['Content-Type']='application/json';
    let response;
    try {response=await fetch(api+path,{...options,headers,signal:AbortSignal.timeout(190000)});}
    catch{throw new Error('Cannot reach the backend. Check API_BASE_URL, allowed origins, and whether the Render service is awake.');}
    if(!response.ok){let body={};try{body=await response.json();}catch{}if(response.status===401 && path!='/api/admin/login')signOut();throw new Error(body.message||'Request failed. Try again.');}
    return options.blob?response.blob():response.json();
  }
  function signOut(){token='';sessionStorage.removeItem('portfolio-admin-token');$('workspace').hidden=true;$('login-panel').hidden=false;$('logout').hidden=true;$('export').hidden=true;$('collections').replaceChildren();}
  async function load(){[data,schema]=await Promise.all([request('/api/admin/content'),request('/api/admin/schema')]);$('login-panel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('export').hidden=false;navigation();openSection(section);}
  function navigation(){const nav=$('collections');nav.replaceChildren();for(const [key,label]of Object.entries(labels)){const button=document.createElement('button');button.type='button';button.textContent=label;button.classList.toggle('active',section===key);button.onclick=()=>{if(canLeave())openSection(key)};nav.append(button);}}
  function canLeave(){return !dirty||confirm('You have unsaved changes. Leave this editor?');}
  function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
  function defaults(fields){return Object.fromEntries(fields.filter(f=>f.default!==undefined||f.widget==='object'||f.widget==='list').map(f=>[f.name,f.default!==undefined?structuredClone(f.default):f.widget==='object'?defaults(f.fields||[]):[]]));}
  function fieldsEditor(fields,value,parent){
    const readers=[];
    for(const field of fields){const current=value?.[field.name];const box=el('div',undefined,'field');parent.append(box);const title=field.label||field.name;let read;
      if(field.widget==='object'){
        const details=el('details');details.append(el('summary',title));const inside=el('div',undefined,'nested');details.append(inside);box.append(details);const child=fieldsEditor(field.fields||[],current||{},inside);read=()=>({...current,...child()});
      }else if(field.widget==='list'){
        const details=el('details');details.open=['items','categories'].includes(field.name);details.append(el('summary',title));box.append(details);const list=el('div');details.append(list);let rows=[];
        function draw(){list.replaceChildren();rows.forEach((row,index)=>{const card=el('div',undefined,'list-row');list.append(card);const actions=el('div',undefined,'row-actions');card.append(actions);for(const [text,action]of [['↑',()=>move(index,-1)],['↓',()=>move(index,1)],['Remove',()=>{rows=rows.filter((_,i)=>i!==index);draw();dirty=true;}]]){const b=el('button',text);b.type='button';b.onclick=()=>{capture();action()};actions.append(b);}
          const rowFields=field.fields||[field.field||{name:'item',label:title,widget:'string',required:false}];const values=field.fields?row.value:{[rowFields[0].name]:row.value};row.read=fieldsEditor(rowFields,values,card);
        });}
        function capture(){rows.forEach(row=>{if(row.read){const v=row.read();row.value=field.fields?v:Object.values(v)[0];}});}
        function move(index,offset){const next=index+offset;if(next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];draw();dirty=true;}
        rows=(Array.isArray(current)?current:[]).map(v=>({value:structuredClone(v)}));draw();const add=el('button','+ Add '+title, 'add-item');add.type='button';add.onclick=()=>{capture();if(field.max && rows.length>=field.max){message('Maximum '+field.max+' items.',true);return;}rows.push({value:field.fields?defaults(field.fields):field.field?.default||''});draw();dirty=true;};details.append(add);read=()=>{capture();return rows.map(row=>row.value);};
      }else if(field.widget==='boolean'){
        const label=el('label',undefined,'check-label'),input=el('input');input.type='checkbox';input.checked=current??field.default??false;label.append(input,el('span',title));box.append(label);read=()=>input.checked;
      }else{
        const label=el('label');label.append(el('span',title+(field.required?' *':'')));const input=el(field.widget==='text'?'textarea':field.widget==='select'?'select':'input');
        if(field.widget==='select') {input.append(new Option('Select…',''));for(const option of field.options||[])input.append(new Option(typeof option==='string'?option:option.label,typeof option==='string'?option:option.value));}
        else if(field.widget==='number') {input.type='number';if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;input.step=field.value_type==='int'?'1':'any';}
        else if(input.tagName==='INPUT')input.type='text';
        input.value=current??field.default??'';input.required=!!field.required;if(field.pattern)input.pattern=field.pattern[0];if(field.name==='id'&&!isNew&&recordId)input.readOnly=true;
        label.append(input);box.append(label);read=()=>field.widget==='number'?(input.value===''?null:Number(input.value)):input.value;
        if(['image','file'].includes(field.widget)){
          const preview=el('div',undefined,'media-field');const image=el('img');image.className='media-preview';image.alt='Current '+title;
          function update(){const path=input.value;image.hidden=!path||field.widget!=='image';if(path)image.src=/^https?:\/\//.test(path)?path:api+'/media/'+path.replace(/^\//,'');}
          preview.append(image);const controls=el('div',undefined,'file-controls'),file=el('input');file.type='file';file.setAttribute('aria-label','Upload '+title);file.accept=field.widget==='image'?'image/png,image/jpeg,image/webp,image/gif':'.pdf,image/png,image/jpeg,image/webp,image/gif';
          file.onchange=async()=>{if(!file.files[0])return;file.disabled=true;try{const form=new FormData();form.append('file',file.files[0]);message('Uploading…');const result=await request('/api/admin/uploads',{method:'POST',body:form});input.value=result.path;update();dirty=true;message('Uploaded. Save the section to publish this image.');}catch(e){message(e.message,true);}finally{file.disabled=false;}};
          const clear=el('button','Clear');clear.type='button';clear.onclick=()=>{input.value='';update();dirty=true;};controls.append(file,clear);preview.append(controls);box.append(preview);input.oninput=update;update();
        }
      }
      if(field.hint)box.append(el('p',field.hint,'hint'));readers.push([field.name,read]);
    }
    return ()=>Object.fromEntries(readers.map(([key,read])=>[key,read()]));
  }
  function openSection(name){section=name;recordId=null;isNew=false;dirty=false;message('');$('page-title').textContent=labels[name];$('editor').replaceChildren();$('record-list').replaceChildren();$('add-record').hidden=!collections.has(name);$('save').hidden=collections.has(name);navigation();if(collections.has(name))listRecords();else edit(data[name]);}
  function listRecords(){for(const item of data[section]||[]){const card=el('article',undefined,'record');card.append(el('strong',item.title||item.id),el('small',(item.published===false?'Hidden':'Published')+' · '+item.id));const actions=el('div');const editButton=el('button','Edit');editButton.onclick=()=>{recordId=item.id;isNew=false;edit(item)};const remove=el('button','Delete','danger');remove.onclick=async()=>{$('confirm-delete').showModal();$('confirm-delete').onclose=async()=>{if($('confirm-delete').returnValue==='delete')await action(async()=>{await request('/api/admin/content/'+section+'/'+item.id,{method:'DELETE'});await load();message('Record deleted.');});};};actions.append(editButton,remove);card.append(actions);$('record-list').append(card);}if(!(data[section]||[]).length)$('record-list').append(el('p','No records yet. Add your first one.','muted'));}
  function edit(value){$('record-list').replaceChildren();$('editor').replaceChildren();$('save').hidden=false;$('add-record').hidden=true;if(collections.has(section)){const back=el('button','← All '+labels[section],'back');back.type='button';back.onclick=()=>{if(canLeave())openSection(section)};$('editor').append(back);}const initial=structuredClone(value||defaults(schema[section]));const reader=fieldsEditor(schema[section],initial,$('editor'));readEditor=()=>({...initial,...reader()});dirty=false;}
  async function action(work){$('save').disabled=true;$('add-record').disabled=true;try{await work();}catch(e){message(e.message,true);}finally{$('save').disabled=false;$('add-record').disabled=false;}}
  $('editor').oninput=()=>dirty=true;$('editor').onchange=()=>dirty=true;$('editor').onsubmit=e=>e.preventDefault();
  $('save').onclick=()=>action(async()=>{if(!$('editor').reportValidity())return;const value=readEditor();const id=collections.has(section)?(recordId||value.id):null;if(collections.has(section)&&!id)throw new Error('Enter a unique record ID.');message('Saving and publishing…');await request('/api/admin/content/'+section+(id?'/'+encodeURIComponent(id):''),{method:isNew?'POST':'PUT',body:JSON.stringify(value)});dirty=false;await load();message('Saved. Your connected portfolio now uses this content.');});
  $('add-record').onclick=()=>{recordId=null;isNew=true;edit(defaults(schema[section]));};
  $('login-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const form=new FormData(e.target);const result=await request('/api/admin/login',{method:'POST',body:JSON.stringify(Object.fromEntries(form))});token=result.token;sessionStorage.setItem('portfolio-admin-token',token);e.target.reset();message('');await load();}catch(error){message(error.message,true);}finally{button.disabled=false;}};
  $('logout').onclick=async()=>{if(!canLeave())return;try{await request('/api/admin/logout',{method:'POST'});}finally{signOut();}};
  $('export').onclick=()=>action(async()=>{const blob=await request('/api/admin/export',{blob:true});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='portfolio-backup.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  if(api)document.querySelector('.legacy').hidden=true;
  if(!api){$('setup-help').hidden=false;$('login-form').querySelector('button').disabled=true;message('This static deployment is not connected to a Spring Boot backend yet. Existing GitHub editing remains available below.');}
  else if(token)load().catch(error=>{signOut();message(error.message,true);});
})();
