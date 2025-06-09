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