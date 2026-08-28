# Docker 배포 가이드 (gajo.odex.kr)

## 구성

- `mongo` : MongoDB 7.0
- `api` : NestJS 온톨로지 엔진 서버 (`server/Dockerfile`)
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

저장소 루트의 `.env.example`을 참고해 운영 secret store 또는 권한이
제한된 루트 `.env`에 값을 주입한다. `server/.env`는 Compose가 자동으로
읽지 않는다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
CLIENT_ID="$(docker compose ps -q client)"
NETWORK_ID="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}' "$CLIENT_ID")"
docker network inspect "$NETWORK_ID" --format '{{json .IPAM.Config}}'
```

- `RATE_LIMIT_HASH_SECRET`: 위와 같이 생성한 32바이트 이상 난수. 출력값을
  문서나 저장소에 기록하지 않는다.
- `RATE_LIMIT_STORE_MODE`: 현재 단일 API 컨테이너에서는 `memory`.
- `TRUSTED_PROXY_ADDRESSES`: exact IP 또는 명시적으로 확인한 Docker 전용
  network CIDR의 쉼표 구분 목록. 빈 값은 어떤 proxy도 신뢰하지 않는다.
  `0.0.0.0/0`과 `::/0`은 사용할 수 없다.

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
        # Edge에서 외부가 보낸 XFF를 폐기하고 확인된 socket peer로 덮어쓴다.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gajo.odex.kr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gajo.odex.kr
```

`client` 컨테이너 Nginx는 edge가 정리한 값에 내부 hop을 추가하는 기존
`$proxy_add_x_forwarded_for` 정책을 유지한다. 호스트 Nginx 설정 반영 전
반드시 `sudo nginx -t`를 통과해야 한다.

## 재배포 (업데이트 시)

```bash
cd /var/www/gajo
git pull origin main
docker compose build
docker compose up -d
```

## 참고

- `client` 컨테이너의 8090은 `127.0.0.1`에만 bind됩니다. `api`(3000),
  `mongo`(27017)는 publish하지 않고 Docker 내부 네트워크에서만 접근합니다.
- 기존 `report.odex.kr` 서비스(별도 docker-compose)와 포트/네트워크가
  분리되어 있어 서로 영향을 주지 않습니다.
