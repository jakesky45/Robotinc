FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Install AWS CLI for credential handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock* ./

RUN uv sync --frozen --no-cache

COPY agent.py ./

RUN useradd -m -u 1000 agent && chown -R agent:agent /app

USER agent

ENV PYTHONUNBUFFERED=1
ENV AWS_REGION=eu-west-2

ENTRYPOINT ["uv", "run", "python", "agent.py"]
CMD []
