import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {RegionProvider} from '../src/RegionContext';
import {RegionalLanguageProvider} from '../src/RegionalLanguageContext';
import RegionalDataManager from '../src/components/RegionalDataManager';
import VerifiedChannelActions from '../src/components/VerifiedChannelActions';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/hapcheon/admin']}><RegionProvider><RegionalLanguageProvider><main style={{padding:16,maxWidth:900,margin:'auto'}}><h1>로컬 신규 업소 검증</h1><p>메모리 fixture · 운영 데이터와 연결되지 않습니다.</p><RegionalDataManager/><h2>관광객 공개 연결 미리보기</h2><p>페이지 새로고침으로 공개 결과를 확인합니다. 클릭은 하지 않아도 됩니다.</p><VerifiedChannelActions regionId="hapcheon" placeKey="urn:regional-business:hapcheon-business-fixture"/></main></RegionalLanguageProvider></RegionProvider></MemoryRouter>);
