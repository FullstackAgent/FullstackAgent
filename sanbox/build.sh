#!/bin/bash

# Build script for fullstack-web-runtime Docker image

# Configuration
IMAGE_NAME="fullstackagent/fullstack-web-runtime"
IMAGE_TAG="latest"
DOCKERFILE_PATH="./Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Building FullStack Web Runtime Image${NC}"
echo -e "${GREEN}=========================================${NC}"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo -e "${RED}Error: Dockerfile not found at $DOCKERFILE_PATH${NC}"
    exit 1
fi

# Check if entrypoint.sh exists
if [ ! -f "./entrypoint.sh" ]; then
    echo -e "${RED}Error: entrypoint.sh not found${NC}"
    exit 1
fi

# Build the image
echo -e "${YELLOW}Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" -f "$DOCKERFILE_PATH" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"

    # Show image info
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Image Information:${NC}"
    docker images "${IMAGE_NAME}:${IMAGE_TAG}"

    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Next steps:${NC}"
    echo -e "  1. Test locally: ${YELLOW}docker run -it -p 7681:7681 ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    echo -e "  2. Push to registry: ${YELLOW}docker push ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    echo -e "${GREEN}=========================================${NC}"
else
    echo -e "${RED}❌ Build failed. Check the error messages above.${NC}"
    exit 1
fi