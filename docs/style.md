# FullstackAgent Color Scheme

This document outlines the complete color scheme used by the FullstackAgent project, inspired by VS Code's Dark theme and based on CSS variables defined in `app/globals.css`.

## Overview

Fulling uses a modern CSS variable system with oklch color space, providing a complete dark theme color scheme that closely resembles VS Code's familiar developer-friendly interface. The design features a distinct two-section sidebar architecture with carefully crafted visual hierarchy for optimal user experience.

### Technical Features
- **Color Space**: oklch (better perceptual uniformity)
- **CSS Variables**: Custom properties for easy theme switching
- **Semantic Naming**: Clear, usage-based naming conventions
- **Two-Section Sidebar**: Separated primary navigation and project content areas
- **Accessibility**: WCAG-compliant contrast ratios
- **VS Code Inspiration**: Familiar dark theme that developers recognize

### Design Philosophy
- **Visual Hierarchy**: Clear distinction between navigation (`#333333`) and content (`#242426`) areas
- **State Management**: Dedicated colors for hover, active, and inactive states
- **Developer Familiarity**: Colors mapped to VS Code's established dark theme patterns

## VS Code-Inspired Dark Theme

### Core Color System

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--background` | `#1E1E1E` | - | Main application background (VS Code editor background) |
| `--foreground` | `#CCCCCC` | `oklch(0.92 0 0)` | Primary text color (VS Code default text) |
| `--content-background` | `#1E1E1E` | - | Content area background |

### Container Colors

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--card` | `#252526` | - | Card and container backgrounds (VS Code panels) |
| `--card-foreground` | `#ffffff` | - | Card title text color (for card titles only) |
| `--popover` | `#252526` | - | Dialog and popup backgrounds |
| `--popover-foreground` | `#CCCCCC` | - | Dialog text color |

### Brand Colors

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--primary` | `#10639D` | - | Primary brand color (buttons, links, accents) |
| `--primary-hover` | `#155a8a` | - | Primary brand hover state |
| `--primary-foreground` | `#FFFFFF` | - | Text on primary elements |
| `--ring` | - | `oklch(0.62 0.19 259.76)` | Focus ring color |

### Secondary Colors

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--secondary` | - | `oklch(0.27 0 0)` | Secondary buttons, tags, badges |
| `--secondary-foreground` | - | `oklch(0.92 0 0)` | Text on secondary elements |

### Functional Colors

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--muted` | - | `oklch(0.27 0 0)` | Supporting element backgrounds |
| `--muted-foreground` | - | `oklch(0.72 0 0)` | Secondary text, descriptions |
| `--accent` | `#2B2D2E` | - | Hover states, highlights (VS Code selection) |
| `--accent-foreground` | - | `oklch(0.88 0.06 254.63)` | Text on accent elements |
| `--destructive` | - | `oklch(0.64 0.21 25.39)` | Delete actions, error states |
| `--destructive-foreground` | - | `oklch(1.0000 0 0)` | Text on destructive elements |

### Borders and Inputs

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--border` | - | `oklch(0.37 0 0)` | Border colors (VS Code widget borders) |
| `--input` | - | `oklch(0.37 0 0)` | Input field borders and backgrounds |

## Sidebar Color Scheme

The sidebar uses an independent color system with two distinct sections to create visual hierarchy, similar to VS Code's activity bar and sidebar:

### Sidebar Primary Section

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--sidebar-primary-background` | `#333333` | - | Sidebar primary background (navigation area) |
| `--sidebar-primary-foreground` | `#808080` | - | Sidebar primary text color |
| `--sidebar-primary-accent` | - | `oklch(0.49 0.24 264.40)` | Sidebar primary accent elements |
| `--sidebar-primary-accent-foreground` | - | `oklch(0.99 0 0)` | Sidebar primary accent text |
| `--sidebar-primary-hover` | `#2B2D2E` | - | Sidebar primary hover backgrounds |
| `--sidebar-primary-hover-foreground` | - | `oklch(0.99 0 0)` | Sidebar primary hover text |
| `--sidebar-primary-active` | `#FFFFFF` | - | Sidebar primary active text color |
| `--sidebar-primary-border` | - | `oklch(1.00 0 0 / 10%)` | Sidebar primary borders |
| `--sidebar-primary-ring` | - | `oklch(0.55 0.02 285.93)` | Sidebar primary focus rings |

### Sidebar Project Section

| Variable | Hex Value | oklch Value | Usage |
|----------|-----------|-------------|-------|
| `--sidebar-project-background` | `#242426` | - | Project section background (project cards area) |
| `--sidebar-project-foreground` | `#CCCCCC` | - | Project section text color |
| `--sidebar-project-active-background` | `#3A3D41` | - | Project section active background |

## Chart Color Scheme

Sequential color palette for data visualization:

| Variable | oklch Value | Description |
|----------|-------------|-------------|
| `--chart-1` | `oklch(0.71 0.14 254.69)` | Primary chart color (blue spectrum) |
| `--chart-2` | `oklch(0.62 0.19 259.76)` | Secondary chart color (deep blue) |
| `--chart-3` | `oklch(0.55 0.22 262.96)` | Tertiary chart color (blue-purple) |
| `--chart-4` | `oklch(0.49 0.22 264.43)` | Quaternary chart color (purple) |
| `--chart-5` | `oklch(0.42 0.18 265.55)` | Quinary chart color (deep purple) |

## Shadow System

Multi-level shadow effects optimized for dark theme:

| Variable | CSS Value | Usage |
|----------|-----------|-------|
| `--shadow-2xs` | `0px 4px 8px -1px hsl(0 0% 0% / 0.05)` | Extra extra small shadow |
| `--shadow-xs` | `0px 4px 8px -1px hsl(0 0% 0% / 0.05)` | Extra small shadow |
| `--shadow-sm` | `0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)` | Small shadow |
| `--shadow` | `0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)` | Default shadow |
| `--shadow-md` | `0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 2px 4px -2px hsl(0 0% 0% / 0.10)` | Medium shadow |
| `--shadow-lg` | `0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 4px 6px -2px hsl(0 0% 0% / 0.10)` | Large shadow |
| `--shadow-xl` | `0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 8px 10px -2px hsl(0 0% 0% / 0.10)` | Extra large shadow |
| `--shadow-2xl` | `0px 4px 8px -1px hsl(0 0% 0% / 0.25)` | Extra extra large shadow |

## Typography and Border Radius

### Font Families
- `--font-serif`: Source Serif 4, serif
- `--font-mono`: JetBrains Mono, monospace (developer-friendly)

### Border Radius System
- `--radius`: `0.375rem` (base radius)
- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)`
- `--radius-xl`: `calc(var(--radius) + 4px)`

## Tabs Component Styling

### Tab Container Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--tabs-background` | `#252526` | Tab container background |

### Tab Item States

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--tab-background` | `#292929` | Default/inactive tab background |
| `--tab-foreground` | `#A0A0A0` | Default/inactive tab text color |
| `--tab-active-background` | `#1E1E1E` | Active tab background |
| `--tab-active-foreground` | `#FFFFFF` | Active tab text color |
| `--tab-hover-background` | `#363637` | Hover background for tab buttons |

### Implementation Notes

- **Visual Hierarchy**: Active tabs use a darker background (`#1E1E1E`) with white text for maximum contrast
- **Inactive State**: Default tabs use a lighter background (`#292929`) with muted gray text (`#A0A0A0`)
- **Container**: Tab container uses a distinct purple-tinted background (`#252556`) to differentiate from main content