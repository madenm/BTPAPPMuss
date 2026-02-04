# AgentPro Real Estate SaaS

## Overview

AgentPro is a comprehensive real estate SaaS platform designed to automate property prospecting and enhance photo quality using AI technology. The application provides agents with tools for lead detection, project visualization, CRM management, and portfolio creation. Built as a modern full-stack web application, it features a React frontend with TypeScript, Express.js backend, PostgreSQL database with Drizzle ORM, and includes Stripe integration for payments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development tooling
- **Routing**: Wouter for client-side routing with pages organized in `/client/src/pages/`
- **UI Components**: shadcn/ui component library with Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom design tokens following a dark theme with blue/purple gradient accents
- **State Management**: TanStack Query (React Query) for server state management with custom query client configuration
- **Forms**: React Hook Form with Zod schema validation for type-safe form handling

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database ORM**: Drizzle ORM with PostgreSQL as the primary database
- **API Design**: RESTful API structure with routes organized in `/server/routes.ts`
- **Data Layer**: Repository pattern implemented through storage interfaces in `/server/storage.ts`
- **Development**: Hot module replacement with Vite middleware integration for seamless development experience

### Database Design
- **Primary Database**: PostgreSQL with Neon Database as the cloud provider
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Current Schema**: Basic user authentication system with plans for expansion to include properties, leads, projects, and payment data
- **Connection**: Connection pooling using Neon's serverless driver with WebSocket support

### Styling and Design System
- **Design Philosophy**: Modern SaaS interface inspired by Linear and Notion with professional real estate focus
- **Color Palette**: Deep blue primary colors (HSL 220 85% 25%) with electric blue accents (HSL 215 100% 60%) and purple gradients
- **Typography**: Inter font family with Fira Code for monospace needs
- **Component Patterns**: Consistent elevation system with hover effects, card-based layouts, and gradient backgrounds
- **Responsive Design**: Mobile-first approach with Tailwind's responsive utilities

### Authentication & Security
- **User Management**: Basic user schema with username/password authentication ready for implementation
- **Session Management**: Prepared for cookie-based sessions with security best practices
- **Input Validation**: Zod schemas for runtime type checking and validation

## External Dependencies

### Core Technology Stack
- **Database**: Neon Database (PostgreSQL-compatible serverless database)
- **Payment Processing**: Stripe integration with React Stripe.js for payment handling
- **Development Tools**: 
  - Vite for build tooling and development server
  - Replit integration with cartographer plugin and runtime error overlay
  - ESBuild for production builds

### UI and Visualization Libraries
- **Component Library**: Radix UI primitives for accessible headless components
- **Charts and Data Visualization**: Recharts for dashboard analytics and reporting
- **Animations**: Framer Motion for smooth transitions and micro-interactions
- **Icons**: Lucide React for consistent iconography

### Development and Build Tools
- **TypeScript**: Full type safety across frontend and backend
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **PostCSS**: CSS processing with autoprefixer
- **Drizzle Kit**: Database schema management and migrations

### Planned Integrations
- **AI Services**: Photo enhancement and property visualization capabilities (in development)
- **Real Estate APIs**: Property data aggregation services (planned)
- **Email Services**: Automated communications and notifications (planned)
- **File Storage**: Cloud storage for property images and documents (planned)