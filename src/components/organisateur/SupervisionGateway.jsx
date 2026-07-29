/**
 * Supervision Gateway - Organisateur
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * Tableau de bord en temps réel pour superviser les entrées et les agents
 * AJOUTS :
 * - Compteur global (entrées vs tickets vendus)
 * - Performance des agents en temps réel
 * - Journal des alertes
 * - Mise à jour automatique toutes les 10 secondes
 * - Accès uniquement Premium
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  ArrowLeft, Users, Ticket, Clock, AlertCircle, CheckCircle,
  XCircle, Loader, RefreshCw, Eye, Search, Filter,
  TrendingUp, BarChart3, Crown, Lock, Mail, Phone,
  User, Calendar, MapPin, Activity, Wifi, WifiOff,
  Radio, Shield, Zap, Award, Star, ChevronRight,
  Home, Menu, X, Settings, Bell, BellOff, Info
} from 'lucide-react'

const SupervisionGateway = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  
  // États principaux
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // État du plan
  const [isPremium, setIsPremium] = useState(false)
  const [checkingPremium, setCheckingPremium] = useState(true)
  
  // Statistiques globales
  const [stats, setStats] = useState({
    totalTicketsVendus: 0,
    totalEntrees: 0,
    totalRestants: 0,
    tauxValidation: 0,
    evenementsActifs: 0,
    agentsActifs: 0,
    alertesNonLues: 0
  })
  
  // Événements actifs
  const [evenements, setEvenements] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  // Agents
  const [agents, setAgents] = useState([])
  const [agentPerformance, setAgentPerformance] = useState([])
  
  // Alertes
  const [alertes, setAlertes] = useState([])
  const [alertesNonLues, setAlertesNonLues] = useState(0)
  const [showAlertes, setShowAlertes] = useState(false)
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAlerte, setFilterAlerte] = useState('toutes')
  
  // Période d'actualisation
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  
  // Référence pour l'intervalle
  const refreshInterval = useRef(null)
  
  // ============================================================
  // VÉRIFICATION PREMIUM
  // ============================================================
  
  useEffect(() => {
    const checkPlan = async () => {
      try {
        setCheckingPremium(true)
        const { data, error } = await supabase
          .from('profiles')
          .select('plan_id')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        
        if (data && data.plan_id === 'Premium') {
          setIsPremium(true)
        } else {
          setIsPremium(false)
        }
      } catch (error) {
        console.error('Erreur vérification plan:', error)
        setIsPremium(false)
      } finally {
        setCheckingPremium(false)
      }
    }

    if (user) {
      checkPlan()
    }
  }, [user])

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================
  
  useEffect(() => {
    if (user && isPremium) {
      fetchAllData()
      
      // Mise à jour automatique toutes les 10 secondes
      if (autoRefresh) {
        refreshInterval.current = setInterval(() => {
          fetchAllData(true)
        }, 10000)
      }
      
      return () => {
        if (refreshInterval.current) {
          clearInterval(refreshInterval.current)
        }
      }
    }
  }, [user, isPremium, autoRefresh])

  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError('')
    
    try {
      await Promise.all([
        fetchStats(),
        fetchEvenements(),
        fetchAgents(),
        fetchAgentPerformance(),
        fetchAlertes()
      ])
      
      setLastUpdate(new Date())
      
      if (!silent) {
        setSuccess('✅ Données actualisées')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
      if (!silent) {
        setError('Erreur lors du chargement des données')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
      setRefreshing(false)
    }
  }, [user])

  // ============================================================
  // RÉCUPÉRATION DES STATISTIQUES
  // ============================================================
  
  const fetchStats = async () => {
    try {
      // Récupérer tous les événements de l'organisateur
      const { data: events, error: eventsError } = await supabase
        .from('evenements')
        .select('id')
        .eq('organisateur_id', user.id)
      
      if (eventsError) throw eventsError
      
      const eventIds = events?.map(e => e.id) || []
      
      if (eventIds.length === 0) {
        setStats({
          totalTicketsVendus: 0,
          totalEntrees: 0,
          totalRestants: 0,
          tauxValidation: 0,
          evenementsActifs: 0,
          agentsActifs: 0,
          alertesNonLues: 0
        })
        return
      }
      
      // Compter les tickets vendus
      const { count: ticketsVendus, error: ticketsError } = await supabase
        .from('ventes')
        .select('*', { count: 'exact', head: true })
        .in('evenement_id', eventIds)
      
      if (ticketsError) throw ticketsError
      
      // Compter les tickets scannés (entrées)
      const { count: entrees, error: entreesError } = await supabase
        .from('ventes')
        .select('*', { count: 'exact', head: true })
        .in('evenement_id', eventIds)
        .eq('est_scanner', true)
      
      if (entreesError) throw entreesError
      
      // Compter les événements actifs (date >= aujourd'hui)
      const today = new Date().toISOString()
      const { count: evenementsActifs, error: actifsError } = await supabase
        .from('evenements')
        .select('*', { count: 'exact', head: true })
        .eq('organisateur_id', user.id)
        .gte('date', today)
      
      if (actifsError) throw actifsError
      
      // Compter les agents actifs
      const { count: agentsActifs, error: agentsError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('role', 'agent')
        .eq('statut', true)
      
      if (agentsError) throw agentsError
      
      // Compter les alertes non lues
      const { count: alertesNonLues, error: alertesError } = await supabase
        .from('alertes_securite')
        .select('*', { count: 'exact', head: true })
        .eq('organisateur_id', user.id)
        .eq('lu', false)
      
      if (alertesError) throw alertesError
      
      const totalVendus = ticketsVendus || 0
      const totalEntrees = entrees || 0
      const totalRestants = totalVendus - totalEntrees
      const tauxValidation = totalVendus > 0 ? Math.round((totalEntrees / totalVendus) * 100) : 0
      
      setStats({
        totalTicketsVendus: totalVendus,
        totalEntrees: totalEntrees,
        totalRestants: totalRestants,
        tauxValidation: tauxValidation,
        evenementsActifs: evenementsActifs || 0,
        agentsActifs: agentsActifs || 0,
        alertesNonLues: alertesNonLues || 0
      })
      
    } catch (error) {
      console.error('Erreur fetchStats:', error)
      throw error
    }
  }

  // ============================================================
  // RÉCUPÉRATION DES ÉVÉNEMENTS
  // ============================================================
  
  const fetchEvenements = async () => {
    try {
      const { data, error } = await supabase
        .from('evenements')
        .select(`
          *,
          types_tickets (id, nom, prix, stock)
        `)
        .eq('organisateur_id', user.id)
        .order('date', { ascending: true })
      
      if (error) throw error
      
      const eventsAvecStats = await Promise.all((data || []).map(async (event) => {
        // Compter les ventes pour cet événement
        const { count: ventes, error: vError } = await supabase
          .from('ventes')
          .select('*', { count: 'exact', head: true })
          .eq('evenement_id', event.id)
        
        if (vError) {
          return { ...event, ventes: 0, entrees: 0 }
        }
        
        // Compter les entrées pour cet événement
        const { count: entrees, error: eError } = await supabase
          .from('ventes')
          .select('*', { count: 'exact', head: true })
          .eq('evenement_id', event.id)
          .eq('est_scanner', true)
        
        if (eError) {
          return { ...event, ventes: ventes || 0, entrees: 0 }
        }
        
        return {
          ...event,
          ventes: ventes || 0,
          entrees: entrees || 0
        }
      }))
      
      setEvenements(eventsAvecStats || [])
      
      if (eventsAvecStats && eventsAvecStats.length > 0 && !selectedEvent) {
        setSelectedEvent(eventsAvecStats[0])
      }
      
    } catch (error) {
      console.error('Erreur fetchEvenements:', error)
      throw error
    }
  }

  // ============================================================
  // RÉCUPÉRATION DES AGENTS
  // ============================================================
  
  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('created_by', user.id)
        .eq('role', 'agent')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setAgents(data || [])
      
    } catch (error) {
      console.error('Erreur fetchAgents:', error)
      throw error
    }
  }

  // ============================================================
  // RÉCUPÉRATION DE LA PERFORMANCE DES AGENTS
  // ============================================================
  
  const fetchAgentPerformance = async () => {
    try {
      if (agents.length === 0) {
        setAgentPerformance([])
        return
      }
      
      const agentIds = agents.map(a => a.id)
      
      // Récupérer les statistiques de chaque agent
      const performances = await Promise.all(agents.map(async (agent) => {
        // Scans réussis
        const { count: succes, error: sError } = await supabase
          .from('scans_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .eq('statut', 'succes')
        
        if (sError) {
          return { ...agent, succes: 0, echecs: 0, fraude: 0, total: 0 }
        }
        
        // Scans en échec
        const { count: echecs, error: eError } = await supabase
          .from('scans_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .in('statut', ['echec', 'fraude', 'doublon'])
        
        if (eError) {
          return { ...agent, succes: succes || 0, echecs: 0, fraude: 0, total: succes || 0 }
        }
        
        // Dernier scan
        const { data: dernier, error: dError } = await supabase
          .from('scans_tickets')
          .select('date_scan')
          .eq('agent_id', agent.id)
          .order('date_scan', { ascending: false })
          .limit(1)
        
        if (dError) {
          return {
            ...agent,
            succes: succes || 0,
            echecs: echecs || 0,
            fraude: 0,
            total: (succes || 0) + (echecs || 0),
            dernierScan: null
          }
        }
        
        return {
          ...agent,
          succes: succes || 0,
          echecs: echecs || 0,
          fraude: 0,
          total: (succes || 0) + (echecs || 0),
          dernierScan: dernier?.[0]?.date_scan || null
        }
      }))
      
      // Trier par nombre de succès décroissant
      performances.sort((a, b) => b.succes - a.succes)
      
      setAgentPerformance(performances)
      
    } catch (error) {
      console.error('Erreur fetchAgentPerformance:', error)
      throw error
    }
  }

  // ============================================================
  // RÉCUPÉRATION DES ALERTES
  // ============================================================
  
  const fetchAlertes = async () => {
    try {
      const { data, error } = await supabase
        .from('alertes_securite')
        .select(`
          *,
          agent:profiles(id, nom_complet, structure, email),
          ticket:ventes(id, client_nom, qr_code)
        `)
        .eq('organisateur_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setAlertes(data || [])
      
      const nonLues = data?.filter(a => !a.lu).length || 0
      setAlertesNonLues(nonLues)
      
    } catch (error) {
      console.error('Erreur fetchAlertes:', error)
      throw error
    }
  }

  // ============================================================
  // MARQUER UNE ALERTE COMME LUE
  // ============================================================
  
  const marquerAlerteCommeLue = async (alerteId) => {
    try {
      const { error } = await supabase
        .from('alertes_securite')
        .update({ lu: true })
        .eq('id', alerteId)
        .eq('organisateur_id', user.id)
      
      if (error) throw error
      
      await fetchAlertes()
      
    } catch (error) {
      console.error('Erreur marquage alerte:', error)
    }
  }

  // ============================================================
  // MARQUER TOUTES LES ALERTES COMME LUES
  // ============================================================
  
  const marquerToutesAlertesCommeLues = async () => {
    try {
      const { error } = await supabase
        .from('alertes_securite')
        .update({ lu: true })
        .eq('organisateur_id', user.id)
        .eq('lu', false)
      
      if (error) throw error
      
      await fetchAlertes()
      await fetchStats()
      
      setSuccess('✅ Toutes les alertes marquées comme lues')
      setTimeout(() => setSuccess(''), 3000)
      
    } catch (error) {
      console.error('Erreur marquage toutes alertes:', error)
    }
  }

  // ============================================================
  // RAFRAÎCHIR
  // ============================================================
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllData(false)
  }

  // ============================================================
  // FORMATAGE
  // ============================================================
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Non défini'
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAlerteIcone = (type, niveau) => {
    if (niveau === 'critique') {
      return <AlertCircle className="w-5 h-5 text-red-400" />
    }
    if (type === 'fraude' || type === 'doublon') {
      return <XCircle className="w-5 h-5 text-red-400" />
    }
    if (type === 'systeme' || type === 'expiration') {
      return <AlertCircle className="w-5 h-5 text-yellow-400" />
    }
    return <Info className="w-5 h-5 text-blue-400" />
  }

  const getAlerteCouleur = (type, niveau) => {
    if (niveau === 'critique') return 'border-red-500/30 bg-red-500/5'
    if (type === 'fraude' || type === 'doublon') return 'border-red-500/30 bg-red-500/5'
    if (type === 'systeme' || type === 'expiration') return 'border-yellow-500/30 bg-yellow-500/5'
    return 'border-blue-500/30 bg-blue-500/5'
  }

  const getAlerteLabel = (type) => {
    const labels = {
      'fraude': '🚨 Fraude détectée',
      'doublon': '🔄 Ticket doublon',
      'systeme': '⚠️ Erreur système',
      'tentative': '🔒 Tentative invalide',
      'expiration': '⏰ Expiration',
      'scan_fail': '❌ Échec de scan'
    }
    return labels[type] || type
  }

  // ============================================================
  // RENDU - VÉRIFICATION PREMIUM
  // ============================================================
  
  if (checkingPremium) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-800 text-center">
          <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Accès Premium requis</h2>
          <p className="text-gray-400 text-sm mb-6">
            La supervision des entrées est disponible uniquement pour les utilisateurs du plan Premium.
            <br />
            <br />
            Contactez l'administrateur pour passer au plan Premium.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://wa.me/22607396519"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <Phone className="w-5 h-5" />
              WhatsApp : 07 396 519
            </a>
            <a
              href="mailto:fasoticket.burkindi@gmail.com"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <Mail className="w-5 h-5" />
              fasoticket.burkindi@gmail.com
            </a>
          </div>
          <button
            onClick={() => navigate('/organisateur/dashboard')}
            className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Chargement de la supervision...</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  
  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* ===== EN-TÊTE ===== */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/organisateur/dashboard')}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                <span className="text-yellow-400">Supervision</span> des entrées
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">Plan Premium</span>
                <span className="text-gray-500 text-sm">•</span>
                <span className="text-gray-400 text-sm">
                  {stats.evenementsActifs} événement(s) actif(s)
                </span>
                {alertesNonLues > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                    {alertesNonLues} alerte(s)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                autoRefresh 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {autoRefresh ? <Activity className="w-4 h-4" /> : <Activity className="w-4 h-4 opacity-50" />}
              {autoRefresh ? 'Auto' : 'Manuel'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '...' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        {/* ===== STATISTIQUES GLOBALES ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.totalTicketsVendus}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Tickets vendus</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-green-500/20 text-center">
            <div className="text-green-400 text-xl font-bold">{stats.totalEntrees}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">✅ Entrées</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-yellow-500/20 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.totalRestants}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">⏳ Restants</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-blue-500/20 text-center">
            <div className={`text-xl font-bold ${stats.tauxValidation > 80 ? 'text-green-400' : stats.tauxValidation > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.tauxValidation}%
            </div>
            <div className="text-gray-400 text-[10px] md:text-xs">Taux de validation</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.evenementsActifs}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Événements actifs</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.agentsActifs}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Agents actifs</div>
          </div>
        </div>

        {/* ===== ALERTES ===== */}
        {alertesNonLues > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 animate-pulse" />
              <div>
                <p className="text-white font-medium">
                  {alertesNonLues} alerte(s) de sécurité non lue(s)
                </p>
                <p className="text-gray-400 text-sm">Cliquez sur l'onglet Alertes pour les consulter</p>
              </div>
            </div>
            <button
              onClick={() => setShowAlertes(!showAlertes)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              {showAlertes ? 'Masquer' : 'Voir les alertes'}
            </button>
          </div>
        )}

        {/* ===== ONGLETS ===== */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-3">
          <button
            onClick={() => setShowAlertes(false)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              !showAlertes
                ? 'bg-yellow-400 text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Événements & Agents
          </button>
          <button
            onClick={() => setShowAlertes(true)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium relative ${
              showAlertes
                ? 'bg-yellow-400 text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Alertes
            {alertesNonLues > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {alertesNonLues}
              </span>
            )}
          </button>
        </div>

        {/* ===== CONTENU ===== */}
        {!showAlertes ? (
          <div className="space-y-6">
            
            {/* ===== SÉLECTION DE L'ÉVÉNEMENT ===== */}
            {evenements.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="text-gray-400 text-sm">Événement sélectionné</p>
                    <select
                      value={selectedEvent?.id || ''}
                      onChange={(e) => {
                        const event = evenements.find(ev => ev.id === e.target.value)
                        setSelectedEvent(event)
                      }}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm mt-1 w-full sm:w-auto"
                    >
                      {evenements.map(event => (
                        <option key={event.id} value={event.id}>
                          {event.nom} - {event.ventes || 0} tickets
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedEvent && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">
                        📅 {formatDate(selectedEvent.date)}
                      </span>
                      <span className="text-gray-400">
                        📍 {selectedEvent.lieu}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== PERFORMANCE DES AGENTS ===== */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-white font-semibold">Performance des agents</h3>
                <span className="text-gray-400 text-sm">{agentPerformance.length} agent(s)</span>
              </div>
              
              {agentPerformance.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Aucun agent actif</p>
                  <p className="text-sm text-gray-500">Créez des agents pour les voir ici</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Agent</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">Contact</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">✅ Succès</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">❌ Échecs</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden lg:table-cell">Total</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden xl:table-cell">Dernier scan</th>
                        <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentPerformance.map((agent) => {
                        const taux = agent.total > 0 ? Math.round((agent.succes / agent.total) * 100) : 0
                        return (
                          <tr key={agent.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {agent.nom_complet || agent.structure || 'Agent'}
                                </p>
                                <span className={`text-xs ${
                                  agent.statut ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {agent.statut ? '🟢 Actif' : '🔴 Inactif'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                              {agent.email}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-green-400 font-medium">{agent.succes}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-red-400 font-medium">{agent.echecs}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell">
                              {agent.total}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-sm hidden xl:table-cell">
                              {agent.dernierScan ? formatDate(agent.dernierScan) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      taux > 80 ? 'bg-green-400' : taux > 50 ? 'bg-yellow-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${Math.min(taux, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${
                                  taux > 80 ? 'text-green-400' : taux > 50 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {taux}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ===== STATISTIQUES PAR ÉVÉNEMENT ===== */}
            {evenements.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold">Statistiques par événement</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {evenements.map((event) => {
                    const taux = event.ventes > 0 ? Math.round((event.entrees / event.ventes) * 100) : 0
                    return (
                      <div key={event.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-white font-medium text-sm">{event.nom}</h4>
                            <p className="text-gray-400 text-xs">{event.lieu}</p>
                            <p className="text-gray-500 text-xs">{formatDate(event.date)}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            new Date(event.date) > new Date() 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {new Date(event.date) > new Date() ? '📅 En cours' : '✅ Terminé'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                          <div>
                            <p className="text-yellow-400 font-bold">{event.ventes || 0}</p>
                            <p className="text-gray-500 text-xs">Vendus</p>
                          </div>
                          <div>
                            <p className="text-green-400 font-bold">{event.entrees || 0}</p>
                            <p className="text-gray-500 text-xs">Entrées</p>
                          </div>
                          <div>
                            <p className={`font-bold ${taux > 80 ? 'text-green-400' : taux > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {taux}%
                            </p>
                            <p className="text-gray-500 text-xs">Taux</p>
                          </div>
                        </div>
                        <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              taux > 80 ? 'bg-green-400' : taux > 50 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(taux, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===== SECTION ALERTES ===== */
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <h3 className="text-white font-semibold">Journal des alertes</h3>
                {alertesNonLues > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {alertesNonLues} non lue(s)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {alertesNonLues > 0 && (
                  <button
                    onClick={marquerToutesAlertesCommeLues}
                    className="text-gray-400 hover:text-yellow-400 transition-colors text-sm"
                  >
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => setShowAlertes(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filtres */}
            <div className="p-4 border-b border-gray-800 flex flex-wrap gap-2">
              <button
                onClick={() => setFilterAlerte('toutes')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  filterAlerte === 'toutes'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilterAlerte('critique')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  filterAlerte === 'critique'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                ⚠️ Critiques
              </button>
              <button
                onClick={() => setFilterAlerte('fraude')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  filterAlerte === 'fraude'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🚨 Fraudes
              </button>
              <button
                onClick={() => setFilterAlerte('systeme')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  filterAlerte === 'systeme'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                ⚙️ Système
              </button>
            </div>

            {/* Liste des alertes */}
            {alertes.filter(a => filterAlerte === 'toutes' || a.type_alerte === filterAlerte || a.niveau === filterAlerte).length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Aucune alerte trouvée</p>
                <p className="text-sm text-gray-500">Tout est calme pour le moment</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {alertes
                  .filter(a => filterAlerte === 'toutes' || a.type_alerte === filterAlerte || a.niveau === filterAlerte)
                  .map((alerte) => (
                    <div 
                      key={alerte.id} 
                      className={`p-4 hover:bg-gray-800/30 transition-colors ${getAlerteCouleur(alerte.type_alerte, alerte.niveau)} border-l-4 ${
                        alerte.niveau === 'critique' ? 'border-red-500' :
                        alerte.type_alerte === 'fraude' || alerte.type_alerte === 'doublon' ? 'border-red-500' :
                        alerte.type_alerte === 'systeme' || alerte.type_alerte === 'expiration' ? 'border-yellow-500' :
                        'border-blue-500'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getAlerteIcone(alerte.type_alerte, alerte.niveau)}
                            <span className="text-white font-medium text-sm">
                              {getAlerteLabel(alerte.type_alerte)}
                            </span>
                            {!alerte.lu && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                                NOUVEAU
                              </span>
                            )}
                            {alerte.niveau === 'critique' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                                Critique
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm mt-1">{alerte.message}</p>
                          {alerte.agent && (
                            <p className="text-gray-400 text-xs mt-1">
                              👤 {alerte.agent.nom_complet || alerte.agent.structure || 'Agent'} 
                              {alerte.agent.email && ` (${alerte.agent.email})`}
                            </p>
                          )}
                          {alerte.ticket && (
                            <p className="text-gray-400 text-xs">
                              🎫 Ticket: {alerte.ticket.client_nom || 'Anonyme'}
                              {alerte.ticket.qr_code && ` - ID: ${alerte.ticket.qr_code}`}
                            </p>
                          )}
                          {alerte.details && (
                            <p className="text-gray-500 text-xs mt-1">
                              📋 {JSON.stringify(alerte.details)}
                            </p>
                          )}
                          <p className="text-gray-500 text-[10px] mt-1">
                            {formatDate(alerte.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {!alerte.lu && (
                            <button
                              onClick={() => marquerAlerteCommeLue(alerte.id)}
                              className="text-gray-400 hover:text-yellow-400 transition-colors text-xs"
                            >
                              Marquer comme lu
                            </button>
                          )}
                          <span className={`text-[10px] ${
                            alerte.lu ? 'text-gray-500' : 'text-yellow-400'
                          }`}>
                            {alerte.lu ? '✅ Lu' : '📩 Non lu'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ===== DERNIÈRE MISE À JOUR ===== */}
        <div className="mt-4 text-center text-gray-500 text-xs">
          Dernière mise à jour : {lastUpdate ? formatDate(lastUpdate) : 'Jamais'}
          {error && (
            <span className="text-red-400 ml-4">⚠️ {error}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default SupervisionGateway