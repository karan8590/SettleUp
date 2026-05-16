# SettleUp - Project Structure & File Descriptions

SettleUp is a premium borrowing tracker built with **TanStack Start** (SSR), **Tailwind CSS**, and **Supabase**. It is optimized for mobile-first usage and supports PDF report generation.

## 📂 Project Structure

```text
.
├── api/                    # Vercel Serverless Functions
│   └── index.js            # Main entry point for Vercel deployment
├── src/                    # Main application source code
│   ├── components/         # React components (UI & Features)
│   │   ├── ui/             # Reusable Shadcn UI components
│   │   ├── borrowing-card.tsx
│   │   ├── history-sheet.tsx
│   │   └── ...
│   ├── integrations/       # External service integrations (Supabase, Lovable)
│   ├── lib/                # Utilities, helper functions, and server functions
│   │   ├── borrowings.functions.ts  # Backend logic (Server Functions)
│   │   ├── generate-pdf.ts          # PDF export logic
│   │   └── ...
│   ├── routes/             # TanStack Router page definitions
│   ├── hooks/              # Custom React hooks
│   ├── styles.css          # Global styles & Tailwind configuration
│   └── server.ts           # SSR Entry point for TanStack Start
├── supabase/               # Database migrations and configuration
├── vercel.json             # Vercel deployment configuration
├── vite.config.ts          # Vite & TanStack build configuration
└── package.json            # Project dependencies and scripts
```

---

## 📄 File Descriptions

### ⚙️ Configuration & Deployment
- **`vercel.json`**: Configures Vercel for SSR deployment. It ensures static assets are served from `dist/client` and all other requests are routed to the `api/` handler.
- **`vite.config.ts`**: The core build configuration. It integrates TanStack Start, Tailwind CSS, and handles the split between client and server builds.
- **`package.json`**: Lists all project dependencies, including TanStack Router/Start, Radix UI, and Supabase.
- **`nitro.config.ts`**: Configures the Nitro server engine (used by TanStack Start) to target the Vercel preset.
- **`tsconfig.json`**: TypeScript configuration with path aliases (e.g., `@/*` -> `src/*`).

### 🛠️ Backend & Server Logic (`src/lib/` & `api/`)
- **`api/index.js`**: A bridge for Vercel Node.js runtime that executes the TanStack Start server handler.
- **`src/lib/borrowings.functions.ts`**: Contains **Server Functions** that interact directly with Supabase. This handles creating/deleting borrowings and recording payments.
- **`src/server.ts`**: The main SSR entry point that handles the initial request rendering on the server.
- **`src/integrations/supabase/`**: Contains the Supabase client initialization and authentication middleware (`auth-middleware.ts`).

### 🎨 UI Components (`src/components/`)
- **`borrowing-card.tsx`**: The primary card component showing person name, amount remaining, and progress bars.
- **`history-sheet.tsx`**: A bottom sheet that displays the full payment history and status summary for a specific loan.
- **`payment-dialog.tsx`**: The interactive modal for recording new payments (Cash/Online toggle).
- **`add-borrowing-dialog.tsx`**: Modal for creating a new borrowing record.
- **`ui/`**: A collection of low-level accessible components like Buttons, Dialogs, Drawers, and Inputs (based on Shadcn UI).

### 🛣️ Routing (`src/routes/`)
- **`__root.tsx`**: The master layout component. Contains the global navigation, viewport meta tags, and high-level providers.
- **`_authenticated.tsx`**: A layout wrapper that protects routes, ensuring only logged-in users can access the dashboard.
- **`index.tsx`**: The main dashboard page listing all active borrowings.
- **`login.tsx`**: The authentication page.

### 🧰 Utilities & Helpers (`src/lib/`)
- **`generate-pdf.ts`**: Uses `jspdf` to generate professional-grade PDF reports of borrowings, including tables and summary stats.
- **`format.ts`**: Helper functions for Currency (INR) and Date formatting.
- **`utils.ts`**: Standard Tailwind class merging utility (`cn`).
- **`error-capture.ts`**: Logic for capturing and displaying SSR-level errors gracefully.
