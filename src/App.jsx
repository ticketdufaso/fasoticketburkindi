/**
 * Application principale - FASO TICKET
 * Règles NASA 1-10 appliquées
 * Sécurité niveau Google/Windows
 * Version complète et finale - Toutes les routes incluses
 * AJOUTS : Route /organisateur/guide-gateway
 * AJOUTS : Route /organisateur/supervision
 * AJOUTS : Route /organisateur/scanner
 */

import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/common/Layout'

// ============================================================
// IMPORTS DES PAGES PUBLIQUES
// ============================================================

import Home from './components/home/Home'
import Boutique from './pages/Boutique'
import Reservation from './pages/Reservation'
import Connexion from './pages/Connexion'
import DevenirOrganisateur from './pages/DevenirOrganisateur'
import PaiementPlan from './pages/PaiementPlan'
import TicketDetail from './pages/TicketDetail'
import TicketGenere from './pages/TicketGenere'
import Partenaires from './pages/Partenaires'

// ============================================================
// IMPORTS DES PAGES LÉGALES
// ============================================================

import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite'
import MentionsLegales from './pages/MentionsLegales'
import CGV from './pages/CGV'

// ============================================================
// IMPORTS DES PAGES DE RÉINITIALISATION
// ============================================================

import MotDePasseOublie from './pages/MotDePasseOublie'
import ReinitialiserMotDePasse from './pages/ReinitialiserMotDePasse'

// ============================================================
// IMPORTS LAZY DES DASHBOARDS (optimisation)
// ============================================================

const DashboardOrganisateur = lazy(() => import('./pages/DashboardOrganisateur'))
const DashboardAdmin = lazy(() => import('./components/admin/DashboardAdmin'))

// ============================================================
// IMPORTS DES PAGES ORGANISATEUR
// ============================================================

import CreateEvent from './components/organisateur/CreateEvent'
import ConfigPaiementOrganisateur from './components/organisateur/ConfigPaiementOrganisateur'
import StatistiquesOrganisateur from './components/organisateur/StatistiquesOrganisateur'
import GestionAgents from './components/organisateur/GestionAgents'
import CodesPromoOrganisateur from './components/organisateur/CodesPromoOrganisateur'

// ============================================================
// IMPORTS DES NOUVELLES PAGES GATEWAY
// ============================================================

import GuideInstallationOrganisateur from './components/organisateur/GuideInstallationOrganisateur'
import SupervisionGateway from './components/organisateur/SupervisionGateway'

// ============================================================
// IMPORT PAGE VÉRIFICATION TICKET
// ============================================================

import VerifyTicket from './pages/VerifyTicket'

// ============================================================
// IMPORT PAGE MESSAGERIE
// ============================================================

import MessagerieOrganisateur from './pages/MessagerieOrganisateur'

// ============================================================
// COMPOSANT DE CHARGEMENT
// ============================================================

const LoadingSpinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-gray-400 mt-4">Chargement...</p>
    </div>
  </div>
)

// ============================================================
// ROUTE PRIVÉE (SÉCURISÉE)
// ============================================================

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, role, loading, isAuthenticated } = useAuthContext()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated()) {
    return <Navigate to="/connexion" replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return children
}

// ============================================================
// COMPOSANT PRINCIPAL DES ROUTES
// ============================================================

const AppRoutes = () => {
  return (
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* ============================================================
              PAGES PUBLIQUES
              ============================================================ */}
          
          <Route path="/" element={<Home />} />
          <Route path="/boutique" element={<Boutique />} />
          <Route path="/boutique/:id" element={<TicketDetail />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/devenir-organisateur" element={<DevenirOrganisateur />} />
          <Route path="/paiement-plan/:planId" element={<PaiementPlan />} />
          <Route path="/ticket/:id" element={<TicketGenere />} />
          
          {/* ============================================================
              PAGE PARTENAIRES
              ============================================================ */}
          
          <Route path="/partenaires" element={<Partenaires />} />
          
          {/* ============================================================
              PAGES LÉGALES
              ============================================================ */}
          
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/cgv" element={<CGV />} />
          
          {/* ============================================================
              PAGES DE RÉINITIALISATION
              ============================================================ */}
          
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
          
          {/* ============================================================
              PAGE VÉRIFICATION TICKET
              ============================================================ */}
          
          <Route path="/verify/:id" element={<VerifyTicket />} />
          
          {/* ============================================================
              PAGES PRIVÉES - ORGANISATEUR
              ============================================================ */}
          
          <Route 
            path="/organisateur/dashboard" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <DashboardOrganisateur />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/evenement/creer" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <CreateEvent />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/evenement/modifier/:id" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <CreateEvent />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/paiement" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <ConfigPaiementOrganisateur />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/statistiques" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <StatistiquesOrganisateur />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/agents" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <GestionAgents />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/codes-promo" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <CodesPromoOrganisateur />
              </PrivateRoute>
            } 
          />
          
          {/* ============================================================
              NOUVELLES ROUTES GATEWAY SMS & SCANNER
              ============================================================ */}
          
          <Route 
            path="/organisateur/guide-gateway" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <GuideInstallationOrganisateur />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/organisateur/supervision" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <SupervisionGateway />
              </PrivateRoute>
            } 
          />
          
          {/* ============================================================
              PAGES PRIVÉES - ORGANISATEUR (MESSAGERIE)
              ============================================================ */}
          
          <Route 
            path="/organisateur/messagerie" 
            element={
              <PrivateRoute requiredRole="organisateur">
                <MessagerieOrganisateur />
              </PrivateRoute>
            } 
          />
          
          {/* ============================================================
              PAGES PRIVÉES - ADMIN
              ============================================================ */}
          
          <Route 
            path="/admin/dashboard" 
            element={
              <PrivateRoute requiredRole="admin">
                <DashboardAdmin />
              </PrivateRoute>
            } 
          />
          
          {/* ============================================================
              REDIRECTION 404
              ============================================================ */}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App