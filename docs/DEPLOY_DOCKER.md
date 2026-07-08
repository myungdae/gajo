# Docker 배포 가이드 (gajo.odex.kr)

## 구성
- `mongo` : MongoDB 7.0
- `api`   : NestJS 온톨로지 엔진 서버 (`server/Dockerfile`)
- `client`: React PWA 정적 빌드 + Nginx (`client/Dockerfile`), `/api`는 api 컨테이너로 프록시

## 1. Docker 설치 (최초 1회)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

## 2. 코드 배포
```bash
sudo mkdir -p /var/www/gajo && sudo chown $USER:$USER /var/www/gajo
cd /var/www/gajo
git clone https://github.com/myungdae/gajo.git .
git checkout main
```

## 3. 빌드 & 실행
```bash
cd /var/www/gajo
docker compose build
docker compose up -d
docker compose ps
```
NestJS 부팅 시 `server/src/ontology-data/*.ttl` 2개 파일이 자동으로 로드되어
메모리 내 RDF 그래프가 만들어지고, `OntologySyncService`가 개체들을 MongoDB에
반영합니다. 별도 시딩 스크립트 실행이 필요 없습니다.

## 4. 헬스 체크
```bash
curl http://localhost:8090/api/ontology/stats
curl -X POST http://localhost:8090/api/demo/scenario
```

## 5. 호스트 Nginx에 gajo.odex.kr 연결
```nginx
server {
    listen 80;
    server_name gajo.odex.kr;
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/gajo.odex.kr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gajo.odex.kr
```

## 재배포 (업데이트 시)
```bash
cd /var/www/gajo
git pull origin main
docker compose build
docker compose up -d
```

## 참고
- `client` 컨테이너만 호스트에 `8090` 포트로 노출됩니다. `api`(3000),
  `mongo`(27017)는 Docker 내부 네트워크에서만 접근 가능합니다.
- 기존 `report.odex.kr` 서비스(별도 docker-compose)와 포트/네트워크가
  분리되어 있어 서로 영향을 주지 않습니다.
