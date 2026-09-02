import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the public Kakao JavaScript key is documented without a checked-in value', () => {
  const example = read('../../.env.example');
  const gitignore = read('../../.gitignore');

  assert.match(example, /^VITE_KAKAO_JAVASCRIPT_KEY=$/m);
  assert.match(gitignore, /^\.env$/m);
});

test('Compose passes the optional JavaScript key only to the client build', () => {
  const compose = read('../../docker-compose.yml');
  const clientService = compose.slice(compose.indexOf('  client:'));

  assert.match(
    clientService,
    /build:\s+[\s\S]*?args:\s+VITE_KAKAO_JAVASCRIPT_KEY: \$\{VITE_KAKAO_JAVASCRIPT_KEY:-\}/,
  );
  assert.doesNotMatch(clientService, /KAKAO_REST_API_KEY|KAKAO_ADMIN_KEY/);
});

test('the Docker build stage exposes the arg to Vite but the runtime stage does not', () => {
  const dockerfile = read('../Dockerfile');
  const [buildStage, runtimeStage = ''] = dockerfile.split(/(?=FROM nginx:)/);

  assert.match(buildStage, /ARG VITE_KAKAO_JAVASCRIPT_KEY=""/);
  assert.match(
    buildStage,
    /ENV VITE_KAKAO_JAVASCRIPT_KEY=\$\{VITE_KAKAO_JAVASCRIPT_KEY\}/,
  );
  assert.ok(buildStage.indexOf('ARG VITE_KAKAO_JAVASCRIPT_KEY') < buildStage.indexOf('RUN npm run build'));
  assert.doesNotMatch(runtimeStage, /VITE_KAKAO_JAVASCRIPT_KEY/);
});

test('the landing keeps Kakao loading and rendering behind the optional build value', () => {
  const landingShare = read('./components/RegionalLandingShare.tsx');

  assert.match(landingShare, /import\.meta\.env\.VITE_KAKAO_JAVASCRIPT_KEY\?\.trim\(\)/);
  assert.match(landingShare, /if\(!kakaoKey\)return/);
  assert.match(landingShare, /\(kakaoKey\|\|posterOverlay\)&&<button/);
  assert.match(landingShare, /Kakao\.Share\.sendDefault/);
  assert.doesNotMatch(landingShare, /KAKAO_REST_API_KEY|KAKAO_ADMIN_KEY/);
});
