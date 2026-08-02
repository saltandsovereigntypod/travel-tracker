import { renderLanding } from './pages/landing.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderTrip } from './pages/trip.js';
import { renderEditor,initEditor } from './pages/editor.js';
import { renderTemplates } from './pages/templates.js';
import { renderAssets } from './pages/assets.js';
import { bindShell,toast,authModal,bindAuth } from './core/components.js';
import { initializeStore,loadState,uploadAsset } from './core/store.js';

const page=document.body.dataset.page;
const renderers={landing:renderLanding,dashboard:renderDashboard,trip:renderTrip,editor:renderEditor,templates:renderTemplates,assets:renderAssets};

async function boot(){
  const app=document.querySelector('#app');
  try{await initializeStore()}catch(error){console.error(error);toast('Supabase is not ready yet. Run supabase/setup.sql, then refresh.');}
  const state=loadState();
  app.innerHTML=(renderers[page]?.()||renderLanding())+authModal();
  bindShell();bindAuth();
  if(page!=='landing'&&!state.auth.signedIn)document.body.classList.add('auth-required');
  if(page==='editor'&&state.auth.signedIn)await initEditor();
  if(page==='assets'&&state.auth.signedIn){
    const input=document.querySelector('[data-file-input]');
    document.querySelectorAll('[data-upload-open]').forEach(b=>b.onclick=()=>input.click());
    input.onchange=async()=>{for(const file of [...input.files]){try{const asset=await uploadAsset(file,{workspaceId:state.workspaces[0]?.id});document.querySelector('[data-asset-grid]').insertAdjacentHTML('afterbegin',`<article class="asset-card"><div class="asset-thumb"><img src="${asset.src}" alt=""></div><div><strong>${asset.name}</strong><small>${asset.collection} • image</small></div><button class="icon-button">•••</button></article>`)}catch(e){toast(e.message)}}toast('Uploads saved to Supabase')};
  }
  document.querySelector('[data-new-project]')?.addEventListener('click',()=>toast('Project creation form is the next CRUD screen to connect.'));
  document.querySelectorAll('[data-trip-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-trip-tab]').forEach(x=>x.classList.toggle('is-active',x===b));toast(`${b.dataset.tripTab} uses the shared project record collection.`)});
}
boot();
