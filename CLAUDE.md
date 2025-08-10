# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React PWA (Progressive Web App) for managing "vales" (vouchers/receipts) in a beauty salon/barber shop context. The application handles service vouchers, expense vouchers, user management, and financial reporting with role-based access control.

### Technology Stack
- **Frontend**: React 19.1.0 with Vite 7.0.0
- **Styling**: Bootstrap 5.3.7 + React Bootstrap 2.10.10
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Charts**: Chart.js with react-chartjs-2
- **PDF Generation**: jsPDF with jsPDF-autotable
- **PWA**: vite-plugin-pwa for offline capabilities
- **Routing**: React Router DOM 7.6.3

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Authentication & Authorization
- Firebase Authentication handles user login/logout
- Role-based access control with 5 roles: `admin`, `anfitrion`, `barbero`, `estilista`, `estetica`
- User roles and metadata stored in Firestore `usuarios` collection
- `AuthContext` (src/context/AuthContext.jsx) provides auth state throughout the app

### Core Data Models

**Vales de Servicio (Service Vouchers)**:
- Collection: `vales_servicio`
- Fields: `peluqueroUid`, `peluquero`, `servicio`, `valor`, `fecha`, `estado`, `comisionExtra`, `dividirPorDos`, `formaPago`, `local`
- States: `pendiente`, `aprobado`, `rechazado`
- Commission system: Supports percentage-based distribution + extra tips

**Vales de Gasto (Expense Vouchers)**:
- Collection: `vales_gasto`
- Fields: `peluqueroUid`, `peluquero`, `descripcion`, `valor`, `fecha`, `estado`, `comisionExtra`, `formaPago`, `local`
- States: `pendiente`, `aprobado`, `rechazado`
- Commission system: Supports extra tips for expense vouchers

**Users**:
- Collection: `usuarios`
- Fields: `email`, `nombre`, `rol`

### Navigation & Routing Structure
- Mobile-first design with bottom navigation bar
- Role-based route protection implemented in App.jsx
- Routes redirect unauthorized users to appropriate pages
- Special Android optimizations for mobile experience

### Key Pages & Functionality

**Dashboard** (`/dashboard` - Admin only):
- Real-time statistics with Chart.js visualizations
- Financial summaries and trends
- User performance metrics

**Vales Servicio** (`/vales-servicio`):
- Create and manage service vouchers
- Real-time filtering by date
- User can only see their own vouchers

**Vales Gasto** (`/vales-gasto`):
- Expense voucher management
- Date-based filtering
- Personal expense tracking

**Aprobar Vales Servicio** (`/aprobar-vales-servicio` - Admin/Anfitrion):
- Advanced filtering system (type, value ranges, text search)
- Bulk approval functionality with mass selection
- Interactive commission editing with real-time calculations
- Mobile-optimized card navigation for individual approvals
- Comprehensive modal system for both individual and bulk operations
- Modern gradient UI with statistics dashboard
- Support for percentage-based commission distribution
- Extra tip/commission management for both service and expense vouchers

**Cuadre Diario** (`/cuadre-diario` - Admin/Anfitrion):
- Daily financial reconciliation with comprehensive reporting
- Mobile-optimized interface with compact list views and pagination
- PDF report generation with detailed breakdowns
- Enhanced statistics with professional commission calculations
- Real-time editing capabilities for commission adjustments
- Responsive card and table views for different screen sizes
- Clear financial information display with improved user understanding

### Important Implementation Details

1. **Firebase Security**: All Firestore queries filter data by `peluqueroUid` to ensure users only access their own data

2. **Real-time Updates**: Uses Firebase `onSnapshot` for live data synchronization across components

3. **Mobile Optimization**: Comprehensive mobile-first approach including:
   - Responsive design with custom breakpoints (mobile ≤768px, tablet 769-1024px, desktop >1024px)
   - Android-specific optimizations (viewport, context menu, scroll behavior)
   - Mobile-optimized navigation with card-based interfaces
   - Pagination systems for high-volume data management
   - Touch-friendly UI elements and swipe navigation
   - Compact list views for better mobile performance

4. **PWA Features**: Configured for offline usage with service worker and app manifest

5. **Date Handling**: Consistent timezone handling with local date formatting throughout the application

6. **Commission System**: Advanced commission management featuring:
   - Percentage-based distribution (50/50, 45/55, or 100% to professional)
   - Extra tip/commission functionality for both service and expense vouchers
   - Real-time calculations with visual previews
   - Editable commissions during approval process
   - Clear financial breakdowns for transparency

## Code Conventions

- Use functional components with React hooks
- Bootstrap classes for styling with custom CSS variables
- Firebase v9+ modular SDK syntax
- Error boundaries and loading states for better UX
- Consistent prop validation and default values

## Environment Variables Required

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## Testing & Quality

- ESLint configuration with React-specific rules
- No test framework currently configured
- Manual testing recommended for Firebase integration

## Deployment

- Configured for Vercel deployment (vercel.json present)
- PWA optimized for mobile app-like experience
- Production build outputs to `dist/` directory

## Firebase Optimization History & Critical Performance Notes

### Major Firebase Optimization (August 2025)

**Background**: The application was consuming excessive Firebase Firestore reads (179,000+ reads in minutes), threatening to exceed the free plan limits (50,000 reads/day). Multiple optimization phases were implemented to reduce consumption by 95%+.

### Critical Firebase Version Information

**IMPORTANT**: The application uses **Firebase v10.14.1** (downgraded from v11.10.0) for stability.

**⚠️ DO NOT UPGRADE to Firebase v11.x** - This version contains critical bugs:
- Internal assertion failures: "FIRESTORE INTERNAL ASSERTION FAILED"
- Target ID conflicts: "Target ID already exists"
- Listener duplication causing exponential read consumption
- WebChannel transport errors during write operations

### Query Optimizations Implemented

**1. Date-Filtered Queries**: All major components now filter by current date on server-side:
```javascript
// Optimized pattern used throughout app:
where('fecha', '>=', fechaDesde), // Today 00:00:00
where('fecha', '<=', fechaHasta), // Today 23:59:59
limit(50) // Reasonable limits
```

**2. Required Firebase Indexes**:
- `vales_servicio`: Compound index (peluqueroUid + fecha)
- `vales_servicio`: Compound index (estado + fecha) 
- `vales_gasto`: Compound index (peluqueroUid + fecha)
- `vales_gasto`: Compound index (estado + fecha)

**3. Component-Specific Optimizations**:

**CuadreDiario** (`src/pages/CuadreDiario.jsx`):
- Before: 500+ documents loaded (90-day range)
- After: 15-50 documents (current date only)
- Reduction: ~95% fewer reads

**ValesServicio** (`src/pages/ValesServicio.jsx`):
- Before: Query all user vales + massive codigo generation query
- After: Current day only + optimized counter system
- Optimized correlative code generation using daily counters

**AprobarValesServicio** (`src/pages/AprobarValesServicio.jsx`):
- Before: All pending vales (any date)
- After: Only pending vales from current day
- Limit reduced: 100 → 50 documents

**ValesGasto** (`src/pages/ValesGasto.jsx`):
- Already optimized with user filtering + 50 document limit

### PWA Optimization System

**Automatic Listener Management**: The app includes PWA optimizations that automatically pause Firebase listeners when the app loses focus:

```javascript
// Pattern implemented across all components:
📱 PWA oculta - Pausando Firebase    // App hidden = listeners paused
📱 PWA visible - Activando Firebase  // App visible = listeners resumed
```

This prevents unnecessary Firebase consumption when users are not actively using the app.

### Performance Results

**Before Optimization**:
- Single vale creation: 700+ Firebase reads
- Page navigation: 500+ reads
- Daily projection: 15,000-30,000+ reads

**After Optimization**:
- Single vale creation: 36 Firebase reads (95% reduction)
- Typical daily usage (50 vales): ~2,300 reads
- Free tier utilization: 4.6% (vs 600%+ before)

### Firebase Consumption Limits & Capacity

**Firebase Free Tier Daily Limits**:
- Reads: 50,000/day
- Writes: 20,000/day  
- Deletes: 20,000/day

**Current App Capacity**:
- Maximum vales per day: 1,388 (limited by reads: 50,000 ÷ 36 reads/vale)
- Current usage (50 vales/day): 3.6% of capacity
- Growth headroom: 27x current volume before hitting limits

### Debug System

**Firebase Debugger** (`src/utils/firebaseDebugger.js`):
```javascript
// Available commands for monitoring:
window.fbReport()                    // Show session statistics
window.fbCountRead("Component", 5)   // Manual read counting
```

Real-time logging shows read counts per operation:
```
📖 [DEBUG] Read: CuadreDiario-ValesServicio (+4) Total: 4
📊 [DEBUG] CuadreDiario ValesServicio: 4 documentos (filtrado en servidor)
```

### Critical Version Management Warning

**⚠️ CRITICAL**: Users with older app versions (Firebase v11.10.0) can cause massive consumption spikes:
- Old version: 700 reads per operation
- New version: 36 reads per operation
- **Risk**: 10 users with old version = potential 350,000 reads/day (7x over limit)

**Mitigation Strategies Required**:
1. Force app updates for users on old versions
2. Monitor Firebase Console for consumption spikes
3. Implement version checking to block outdated clients
4. Use push notifications to encourage updates

### Elimination System Optimization

**Anti-Conflict Deletion**: Special system implemented to prevent Firebase internal errors during delete operations:

```javascript
// Pattern in CuadreDiario.jsx handleEliminar:
setListenersActivos(false)  // Pause listeners
// cleanup existing listeners
// perform deletion
// restart listeners after delay
```

This prevents the Firebase v11.x-era internal assertion failures during write operations.

### Maintenance Notes

1. **Never upgrade Firebase** beyond v10.x without extensive testing
2. **Monitor daily reads** in Firebase Console - expect ~2,000-5,000 reads/day for normal usage
3. **Watch for spikes** >10,000 reads/day = likely users on old app versions
4. **Indexes are critical** - queries will fail without compound indexes for date filtering
5. **PWA cache behavior** may require users to clear cache/reinstall PWA for major updates

### Emergency Rollback Procedure

If Firebase consumption spikes occur:
1. Check Firebase Console usage graphs
2. Identify problematic queries via error logs
3. Temporarily increase query limits while investigating
4. Consider disabling real-time listeners temporarily:
   ```javascript
   // Emergency: disable onSnapshot, use getDocs instead
   const snap = await getDocs(query);  // One-time read
   // instead of: onSnapshot(query, callback);  // Real-time
   ```

This optimization work successfully reduced Firebase consumption from crisis levels (600%+ over limit) to sustainable levels (4.6% of limit), providing years of headroom for growth.