import {useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {api} from '../api/client';
import {AdminRegionProvider} from '../RegionContext';
import AdminPage from './AdminPage';
import '../admin-entry.css';
type Region = {id:string;regionName:string;serviceName:string};
export default function AdminEntry(){
  const location=useLocation(), navigate=useNavigate();
  const [token,setToken]=useState(()=>sessionStorage.getItem('admin-write-token')||'');
  const [access,setAccess]=useState<{token:string;regions:Region[]}>(),[error,setError]=useState('');
  const initial=location.pathname.match(/^\/([^/]+)\/admin\/?$/)?.[1] || new URLSearchParams(location.search).get('regionId') || '';
  const regions=access?.token===token?access.regions:[];
  const region=regions.find(r=>r.id===initial);
  useEffect(()=>{const previous=document.title;document.title='전국 공통 관리자';return()=>{document.title=previous};},[]);
  useEffect(()=>{
    let current=true;setAccess(undefined);setError('');
    if(!token)return;
    api.get('/admin/regions',{headers:{'x-admin-token':token}}).then(({data})=>{
      if(!Array.isArray(data))throw Error();
      if(current)setAccess({token,regions:data});
    }).catch(()=>{if(current)setError('관리자 인증 또는 허용 지역을 확인하지 못했습니다. 인증 정보를 확인해 주세요.');});
    return()=>{current=false};
  },[token]);
  return <main className="admin-entry">
    <section className="card">
      <h1>전국 공통 관리자</h1>
      <label>관리자 인증<input type="password" autoComplete="off" value={token} onChange={e=>{sessionStorage.setItem('admin-write-token',e.target.value);setToken(e.target.value)}}/></label>
      {!token&&<p role="alert">관리자 인증이 필요합니다.</p>}
      {error&&<p role="alert">{error}</p>}
      {token&&!access&&!error&&<p role="status">관리 권한을 확인하는 중입니다.</p>}
      <label>관리 지역<select aria-label="관리 지역" value={region?.id||''} disabled={!regions.length} onChange={e=>navigate('/admin'+(e.target.value?'?regionId='+encodeURIComponent(e.target.value):''))}>
        <option value="">권한 있는 지역을 선택해 주세요</option>
        {regions.map(r=><option key={r.id} value={r.id}>{r.regionName}</option>)}
      </select></label>
      {access&&initial&&!region&&<p role="alert">요청한 지역의 관리 권한이 없습니다. 허용된 지역을 선택해 주세요.</p>}
      {access&&!regions.length&&<p>관리 가능한 지역이 없습니다.</p>}
    </section>
    {region&&<AdminRegionProvider region={region}><AdminPage key={region.id} adminToken={token}/></AdminRegionProvider>}
  </main>;
}
