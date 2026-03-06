.PHONY: dev-api dev-worker dev-frontend redis seed init-corpus init-monitors tunnel

dev-api:
	uvicorn strata.main:app --reload --port 8000

dev-worker:
	celery -A strata.celery_app worker --loglevel=debug --concurrency=1

dev-frontend:
	cd strata-frontend && npm run dev

redis:
	docker-compose up -d redis

seed:
	python -m strata.scripts.seed_assets

init-corpus:
	python -m strata.services.exa_corpus --init

init-monitors:
	python -m strata.services.monitor_manager --init

tunnel:
	ngrok http 8000
