.PHONY: setup-pythonsetup clean-python

setup-python:
	@echo "Setting up Python virtual environment..."
	cd python && \
	python3 -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements.txt
	@echo "Setup complete!"

clean-python:
	@echo "Cleaning up Python virtual environment..."
	rm -rf python/.venv
	@echo "Cleanup complete!"

flatten:
	repo2txt -o flat.txt \
	--exclude-dir node_modules build .vscode python \
	--ignore-files go.sum wails.json README.md CHECKLIST.md IMPLEMENTATION.md PLAN.md pedalboard.ipynb package-lock.json index.72c04241.js vite.config.ts text-rules.json python/dubbing_pipeline_full.py flat.txt index.f50f4009.js \
	--ignore-types .woff2 .png .css
