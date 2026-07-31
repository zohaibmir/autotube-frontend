# YouTube Automation Frontend (Phase 12a)

Professional SaaS frontend for YouTube automation with Scandinavian design principles.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── pages/              # Page components (public & dashboard)
├── components/         # Reusable UI components
├── api/               # API client and services
├── store/             # Zustand stores (auth, user)
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
├── lib/               # Utilities and helpers
└── main.tsx           # Entry point
```

## 🎨 Design System

Built with:
- **Tailwind CSS** - Utility-first styling
- **Custom Color Palette** - Navy + Sky Blue + Accent colors
- **Typography** - Inter (sans-serif) + Lora (serif)
- **Spacing** - 8px grid system (1=8px, 2=16px, etc.)

### Brand Colors
- **Navy** (Trust): `#1A3A52`
- **Sky Blue** (Clarity): `#5B9FBD`
- **Success**: `#2D9D78`
- **Warning**: `#F59E0B`
- **Error**: `#DC2626`

## 🔧 Development

### Available Scripts

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run type-check # TypeScript type checking
```

## 📋 Features (Phase 12a: Setup)

- [x] React 18 + Vite + TypeScript setup
- [x] Tailwind CSS with custom brand colors
- [x] React Router v6 for navigation
- [x] API client with axios and interceptors
- [x] Zustand store for auth state
- [x] Base layout components (Navbar, Footer, DashboardLayout)
- [x] Dashboard page structure
- [x] Types and interfaces for API

### Phase 12b & 12c (Next)
- [ ] Marketing site pages (homepage, pricing, about, contact)
- [ ] Supabase Auth integration
- [ ] Dashboard pages (jobs, settings, billing)
- [ ] Real-time job progress with StreamingText
- [ ] Stripe payment integration
- [ ] API integration with backend

## 🧪 Testing

```bash
npm run test       # Run unit tests
npm run test:e2e   # Run E2E tests
```

## 📦 Dependencies

### Core
- `react@19.2.6` - React framework
- `react-dom@19.2.6` - React DOM
- `react-router-dom@6.20.0` - Routing

### API & State
- `@tanstack/react-query@5.28.0` - Data fetching
- `zustand@4.4.0` - State management
- `axios@1.6.0` - HTTP client

### UI & Styling
- `tailwindcss@3.4.0` - Utility CSS
- `lucide-react@0.294.0` - Icons
- `framer-motion@10.16.0` - Animations

### Forms & Validation
- `react-hook-form@7.48.0` - Form handling
- `zod@3.22.0` - Schema validation

### Payments & Auth
- `@stripe/react-stripe-js@2.5.0` - Stripe UI
- `@stripe/stripe-js@2.1.0` - Stripe JS
- `@supabase/supabase-js@2.38.0` - Supabase (future)

## 📚 Documentation

See `/docs` in the root directory for:
- `FRONTEND_DESIGN_ANALYSIS.md` - Design specifications
- `DESIGN_SYSTEM_INSPIRATION.md` - Design patterns and inspiration
- `DESIGN_SYSTEM_CHOICE.md` - Why Claude Design was chosen
- `SAAS_PROGRESS.md` - Overall Phase 12 timeline and milestones

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
VITE_API_URL=http://localhost:8000/api
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

## 🚀 Deployment

Deploy to Vercel or Netlify:

```bash
# Vercel
vercel

# Netlify
netlify deploy --prod
```

## 📞 Support

For issues or questions, see the main README in the root directory.

---

**Phase 12a Status**: ✅ Setup Complete
**Next**: Phase 12b - Marketing Site (1 week)
