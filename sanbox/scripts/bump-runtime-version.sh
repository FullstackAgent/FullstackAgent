#!/bin/bash

# Script to bump the runtime image version
# Usage: ./bump-runtime-version.sh [major|minor|patch|alpha|beta|rc]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the current version from VERSION file
CURRENT_VERSION=$(cat runtime/VERSION)
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Parse version components
# Remove 'v' prefix and split into parts
VERSION_WITHOUT_V=${CURRENT_VERSION#v}

# Extract base version and prerelease parts
if [[ $VERSION_WITHOUT_V =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-z]+)\.([0-9]+))?$ ]]; then
    MAJOR=${BASH_REMATCH[1]}
    MINOR=${BASH_REMATCH[2]}
    PATCH=${BASH_REMATCH[3]}
    PRERELEASE_TYPE=${BASH_REMATCH[5]}
    PRERELEASE_NUM=${BASH_REMATCH[6]}
else
    echo -e "${RED}Error: Unable to parse version ${CURRENT_VERSION}${NC}"
    exit 1
fi

# Function to create new version string
create_version() {
    local maj=$1
    local min=$2
    local pat=$3
    local pre_type=$4
    local pre_num=$5

    if [ -n "$pre_type" ]; then
        echo "v${maj}.${min}.${pat}-${pre_type}.${pre_num}"
    else
        echo "v${maj}.${min}.${pat}"
    fi
}

# Determine new version based on argument
case "${1:-patch}" in
    major)
        NEW_VERSION=$(create_version $((MAJOR + 1)) 0 0 "" "")
        ;;
    minor)
        NEW_VERSION=$(create_version $MAJOR $((MINOR + 1)) 0 "" "")
        ;;
    patch)
        if [ -n "$PRERELEASE_TYPE" ]; then
            # If current is prerelease, patch removes prerelease
            NEW_VERSION=$(create_version $MAJOR $MINOR $PATCH "" "")
        else
            # Normal patch increment
            NEW_VERSION=$(create_version $MAJOR $MINOR $((PATCH + 1)) "" "")
        fi
        ;;
    alpha)
        if [ "$PRERELEASE_TYPE" = "alpha" ]; then
            # Increment alpha number
            NEW_VERSION=$(create_version $MAJOR $MINOR $PATCH "alpha" $((PRERELEASE_NUM + 1)))
        else
            # Start new alpha
            NEW_VERSION=$(create_version $MAJOR $MINOR $((PATCH + 1)) "alpha" 0)
        fi
        ;;
    beta)
        if [ "$PRERELEASE_TYPE" = "beta" ]; then
            # Increment beta number
            NEW_VERSION=$(create_version $MAJOR $MINOR $PATCH "beta" $((PRERELEASE_NUM + 1)))
        else
            # Start new beta
            NEW_VERSION=$(create_version $MAJOR $MINOR $((PATCH + 1)) "beta" 0)
        fi
        ;;
    rc)
        if [ "$PRERELEASE_TYPE" = "rc" ]; then
            # Increment rc number
            NEW_VERSION=$(create_version $MAJOR $MINOR $PATCH "rc" $((PRERELEASE_NUM + 1)))
        else
            # Start new rc
            NEW_VERSION=$(create_version $MAJOR $MINOR $((PATCH + 1)) "rc" 0)
        fi
        ;;
    *)
        echo -e "${RED}Usage: $0 [major|minor|patch|alpha|beta|rc]${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Update VERSION file
echo "$NEW_VERSION" > runtime/VERSION
echo -e "${GREEN}✓ Updated runtime/VERSION${NC}"

# Update versions.ts
sed -i "s|RUNTIME_IMAGE: 'fullstackagent/fullstack-web-runtime:v[^']*'|RUNTIME_IMAGE: 'fullstackagent/fullstack-web-runtime:${NEW_VERSION}'|" fullstack-agent/lib/config/versions.ts
echo -e "${GREEN}✓ Updated fullstack-agent/lib/config/versions.ts${NC}"

# Update runtime README
sed -i "s|fullstackagent/fullstack-web-runtime:v[0-9.a-z-]*|fullstackagent/fullstack-web-runtime:${NEW_VERSION}|g" runtime/README.md
echo -e "${GREEN}✓ Updated runtime/README.md${NC}"

echo ""
echo -e "${GREEN}Version bumped from ${CURRENT_VERSION} to ${NEW_VERSION}${NC}"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit the changes: git add -A && git commit -m 'Bump runtime version to ${NEW_VERSION}'"
echo "3. Create a git tag: git tag ${NEW_VERSION}"
echo "4. Push to trigger CI/CD: git push origin main --tags"
echo ""
echo "The GitHub Actions workflow will automatically build and push the Docker image with tag: ${NEW_VERSION}"