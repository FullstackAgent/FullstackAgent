#!/bin/bash

# Script to manually build and push the runtime image to Docker Hub
# This ensures the exact image is available with the correct tags

set -e

# Configuration
IMAGE_NAME="fullstackagent/fullstack-web-runtime"
VERSION="v0.0.1-alpha.0"
DOCKERFILE_PATH="./Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Building and Pushing Runtime Image to Docker Hub${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if logged in to Docker Hub
echo -e "${YELLOW}Checking Docker Hub login status...${NC}"
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo -e "${YELLOW}Not logged in to Docker Hub. Please login:${NC}"
    docker login docker.io
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to login to Docker Hub${NC}"
        exit 1
    fi
fi

# Change to runtime directory
cd "$(dirname "$0")"

# Build the image
echo -e "${YELLOW}Building Docker image: ${IMAGE_NAME}:${VERSION}${NC}"
docker build -t "${IMAGE_NAME}:${VERSION}" -f "$DOCKERFILE_PATH" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image built successfully${NC}"

    # Tag with additional versions
    echo -e "${YELLOW}Creating additional tags...${NC}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:0.0.1-alpha.0"
    docker tag "${IMAGE_NAME}:${VERSION}" "${IMAGE_NAME}:0.0.1"

    # Push all tags
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"

    echo -e "${BLUE}Pushing ${IMAGE_NAME}:${VERSION}${NC}"
    docker push "${IMAGE_NAME}:${VERSION}"

    echo -e "${BLUE}Pushing ${IMAGE_NAME}:0.0.1-alpha.0${NC}"
    docker push "${IMAGE_NAME}:0.0.1-alpha.0"

    echo -e "${BLUE}Pushing ${IMAGE_NAME}:0.0.1${NC}"
    docker push "${IMAGE_NAME}:0.0.1"

    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✅ Successfully pushed to Docker Hub!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "Available tags:"
    echo "  - ${IMAGE_NAME}:${VERSION}"
    echo "  - ${IMAGE_NAME}:0.0.1-alpha.0"
    echo "  - ${IMAGE_NAME}:0.0.1"
    echo ""
    echo "Pull command:"
    echo -e "${BLUE}docker pull ${IMAGE_NAME}:${VERSION}${NC}"
    echo ""
    echo "Test locally:"
    echo -e "${BLUE}docker run -it -p 7681:7681 ${IMAGE_NAME}:${VERSION}${NC}"
else
    echo -e "${RED}❌ Build failed. Check the error messages above.${NC}"
    exit 1
fi