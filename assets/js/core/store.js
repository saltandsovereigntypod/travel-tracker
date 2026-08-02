import { supabase } from '../services/supabase-client.js';

const STORAGE_KEY = 'wayfarer-workspace-v2';
const clone = value => JSON.parse(JSON.stringify(value));

export const starterState = {
  currentUser: { id: 'guest', name: 'Traveler', initials: 'T', plan: 'Local preview' },
  workspaces: [], projects: [], records: [], templates: [], assets: [], canvasDesigns: [], views: [], members: [],
  auth: { ready: false, signedIn: false }
};

let cache = (() => {
  try { return { ...clone(starterState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return clone(starterState); }
})();

const initials = name => String(name || 'Traveler').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
const coverFor = project => project.cover?.gradient || 'linear-gradient(135deg,#9CCFE8,#FFF7ED 62%,#F4B183)';

function mapCloud({ user, profile, workspaces, members, projects, records, views, designs, templates, assets }) {
  return {
    currentUser: { id: user.id, name: profile?.display_name || user.email?.split('@')[0] || 'Traveler', initials: initials(profile?.display_name || user.email), email: user.email, plan: 'Cloud workspace' },
    workspaces: workspaces.map(w => ({ id:w.id, name:w.name, ownerId:w.owner_id, settings:w.settings })),
    members: members.map(m => ({ workspaceId:m.workspace_id, userId:m.user_id, role:m.role })),
    projects: projects.map(p => ({ id:p.id, workspaceId:p.workspace_id, type:p.project_type, title:p.title, subtitle:p.subtitle, description:p.description, state:p.status, startDate:p.start_date, endDate:p.end_date, progress:p.progress, cover:coverFor(p), collaborators:['A'], budget:Number(p.budget), spent:Number(p.spent), currency:p.currency, settings:p.settings })),
    records: records.map(r => ({ id:r.id, projectId:r.project_id, type:r.record_type, title:r.title, subtitle:r.subtitle, start:r.start_at, end:r.end_at, status:r.status, cost:Number(r.cost), currency:r.currency, shared:r.is_shared, location:r.location, data:r.data, createdBy:r.created_by })),
    views: views.map(v => ({ id:v.id, projectId:v.project_id, ownerId:v.owner_id, name:v.name, type:v.view_type, visibility:v.visibility, settings:v.settings })),
    canvasDesigns: designs.map(d => ({ id:d.id, viewId:d.view_id, ownerId:d.owner_id, name:views.find(v=>v.id===d.view_id)?.name || 'Canvas design', width:d.width, height:d.height, scene:d.scene, version:d.version, updatedAt:d.updated_at })),
    templates: templates.map(t => ({ id:t.id, name:t.name, category:t.category, style:t.style, personal:t.visibility==='personal', shared:t.visibility==='workspace', scene:t.scene, metadata:t.metadata })),
    assets: assets.map(a => ({ id:a.id, name:a.name, type:a.asset_type, collection:a.collection, storagePath:a.storage_path, src:a.signedUrl || '', metadata:a.metadata })),
    auth: { ready:true, signedIn:true }
  };
}

async function signedAssetUrls(assets) {
  return Promise.all(assets.map(async asset => {
    const { data } = await supabase.storage.from('workspace-assets').createSignedUrl(asset.storage_path, 3600);
    return { ...asset, signedUrl:data?.signedUrl || '' };
  }));
}

export async function initializeStore() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session?.user) {
    cache = { ...clone(starterState), auth:{ ready:true, signedIn:false } };
    return cache;
  }
  const user = session.user;
  await supabase.rpc('seed_starter_workspace');
  const [profileRes, workspacesRes, membersRes, projectsRes, recordsRes, viewsRes, designsRes, templatesRes, assetsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
    supabase.from('workspaces').select('*').order('created_at'),
    supabase.from('workspace_members').select('*'),
    supabase.from('projects').select('*').order('start_date',{ascending:true}),
    supabase.from('records').select('*').order('start_at',{ascending:true,nullsFirst:false}),
    supabase.from('views').select('*').order('created_at'),
    supabase.from('canvas_designs').select('*').order('updated_at',{ascending:false}),
    supabase.from('templates').select('*').order('created_at'),
    supabase.from('assets').select('*').order('created_at',{ascending:false})
  ]);
  const error = [profileRes,workspacesRes,membersRes,projectsRes,recordsRes,viewsRes,designsRes,templatesRes,assetsRes].find(r=>r.error)?.error;
  if (error) throw error;
  const assets = await signedAssetUrls(assetsRes.data || []);
  cache = mapCloud({ user, profile:profileRes.data, workspaces:workspacesRes.data||[], members:membersRes.data||[], projects:projectsRes.data||[], records:recordsRes.data||[], views:viewsRes.data||[], designs:designsRes.data||[], templates:templatesRes.data||[], assets });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  return cache;
}

export function loadState(){ return cache; }
export function saveState(state){ cache=state; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function updateState(mutator){ const state=clone(cache); mutator(state); saveState(state); return state; }
export function resetState(){ localStorage.removeItem(STORAGE_KEY); cache=clone(starterState); return cache; }

export async function saveCanvasDesign(designId, scene) {
  const design = cache.canvasDesigns.find(d => d.id === designId);
  if (!design) throw new Error('No canvas design is available for this view.');
  const { error } = await supabase.from('canvas_designs').update({ scene, version:(design.version||1)+1 }).eq('id',designId);
  if (error) throw error;
  design.scene=scene; design.version=(design.version||1)+1; design.updatedAt=new Date().toISOString(); saveState(cache);
  return design;
}

export async function uploadAsset(file, { workspaceId=null, collection='Uploads' }={}) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (file.size > 10*1024*1024) throw new Error('Choose an image smaller than 10 MB.');
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before uploading assets.');
  const ext=(file.name.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
  const uploaded=await supabase.storage.from('workspace-assets').upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error)throw uploaded.error;
  const inserted=await supabase.from('assets').insert({ owner_id:user.id, workspace_id:workspaceId, name:file.name, asset_type:'image', storage_path:path, collection, metadata:{size:file.size,mime:file.type} }).select().single();
  if(inserted.error)throw inserted.error;
  const signed=await supabase.storage.from('workspace-assets').createSignedUrl(path,3600);
  const asset={id:inserted.data.id,name:file.name,type:'image',collection,storagePath:path,src:signed.data?.signedUrl||'',metadata:inserted.data.metadata};
  cache.assets.unshift(asset);saveState(cache);return asset;
}

export async function signIn(email,password){ const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error; return initializeStore(); }
export async function signUp(name,email,password){ const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}}); if(error)throw error; return true; }
export async function signOut(){ await supabase.auth.signOut(); resetState(); }
