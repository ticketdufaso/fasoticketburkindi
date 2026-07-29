/**
 * Dashboard Organisateur - Version complète
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - SUPPRESSION du bouton "Télécharger" (l'organisateur ne peut plus télécharger)
 * - Conservation UNIQUEMENT du bouton "Envoyer par WhatsApp"
 * - WhatsApp : lien direct (pas de page intermédiaire)
 * - est_telecharger ne change PAS quand l'organisateur agit
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  Plus, Ticket, Users, BarChart3, Calendar, Settings, 
  Eye, Edit, Trash2, Clock, AlertCircle, Download, Send,
  CreditCard, UserPlus, TrendingUp, DollarSign, ShoppingBag,
  Crown, Zap, Code, MessageSquare, FileText, Smartphone,
  Lock, Mail, Phone, CheckCircle, XCircle, Loader, RefreshCw,
  FileSpreadsheet, Radio, Shield, Wifi, WifiOff,
  ChevronRight, Award, Star
} from 'lucide-react'

const DashboardOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    ticketsVendus: 0,
    revenus: 0,
    evenements: 0,
    agents: 0
  })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planInfo, setPlanInfo] = useState({
    nom: '',
    expire: null,
    joursRestants: 0,
    pourcentage: 0,
    evenementsMax: 0,
    agentsMax: 0,
    codesMax: 0,
    typesTickets: [],
    estPremium: false,
    estExpire: false
  })
  const [ventesRecentes, setVentesRecentes] = useState([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)

  // ============================================================
  // ÉTATS POUR LE GATEWAY SMS & SCANNER
  // ============================================================
  
  const [gatewayStatus, setGatewayStatus] = useState({
    estActif: false,
    derniereConnexion: null,
    appareilsConnectes: 0,
    tokenAssocie: null,
    cleExists: false
  })
  const [gatewayLoading, setGatewayLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchAllData()
      fetchUnreadMessagesCount()
      fetchGatewayStatus()
    }
  }, [user])

  // ============================================================
  // RÉCUPÉRATION DU STATUT DU GATEWAY
  // ============================================================

  const fetchGatewayStatus = async () => {
    try {
      setGatewayLoading(true)
      
      const { data: tokenData, error: tokenError } = await supabase
        .from('association_tokens')
        .select('token_cle, derniere_utilisation, actif')
        .eq('organisateur_id', user.id)
        .eq('actif', true)
        .maybeSingle()

      if (tokenError && tokenError.code !== 'PGRST116') {
        throw tokenError
      }

      if (tokenData) {
        const derniereUtilisation = tokenData.derniere_utilisation 
          ? new Date(tokenData.derniere_utilisation) 
          : null
        
        const estActif = tokenData.actif && derniereUtilisation && 
          (Date.now() - derniereUtilisation.getTime()) < 24 * 60 * 60 * 1000

        setGatewayStatus({
          estActif: estActif,
          derniereConnexion: derniereUtilisation,
          appareilsConnectes: 0,
          tokenAssocie: tokenData.token_cle,
          cleExists: true
        })
      } else {
        setGatewayStatus({
          estActif: false,
          derniereConnexion: null,
          appareilsConnectes: 0,
          tokenAssocie: null,
          cleExists: false
        })
      }
    } catch (error) {
      console.error('Erreur récupération statut Gateway:', error)
    } finally {
      setGatewayLoading(false)
    }
  }

  // ============================================================
  // FONCTIONS EXISTANTES
  // ============================================================

  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError('')
      
      await Promise.all([
        fetchPlanInfo(),
        fetchData()
      ])
    } catch (error) {
      console.error('Erreur chargement:', error)
      setError('Erreur lors du chargement des données. Veuillez rafraîchir.')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlanInfo = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('plan_id, plan_expire')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (!profileData || !profileData.plan_id) {
        setPlanInfo({
          nom: 'Aucun plan',
          expire: null,
          joursRestants: 0,
          pourcentage: 0,
          evenementsMax: 0,
          agentsMax: 0,
          codesMax: 0,
          typesTickets: [],
          estPremium: false,
          estExpire: true
        })
        setIsExpired(true)
        return
      }

      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('nom', profileData.plan_id)
        .single()

      if (planError) throw planError

      if (!planData) {
        setPlanInfo({
          nom: profileData.plan_id || 'Inconnu',
          expire: null,
          joursRestants: 0,
          pourcentage: 0,
          evenementsMax: 0,
          agentsMax: 0,
          codesMax: 0,
          typesTickets: [],
          estPremium: false,
          estExpire: true
        })
        setIsExpired(true)
        return
      }

      const expireDate = profileData.plan_expire ? new Date(profileData.plan_expire) : null
      
      if (!expireDate) {
        setPlanInfo({
          nom: planData.nom,
          expire: null,
          joursRestants: 0,
          pourcentage: 0,
          evenementsMax: planData.evenements_max || 0,
          agentsMax: planData.agents_max || 0,
          codesMax: planData.codes_max || 0,
          typesTickets: planData.types_tickets || [],
          estPremium: planData.nom === 'Premium',
          estExpire: true
        })
        setIsExpired(true)
        return
      }

      const now = new Date()
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const expireDateOnly = new Date(expireDate.getFullYear(), expireDate.getMonth(), expireDate.getDate())
      
      const diffTime = expireDateOnly.getTime() - nowDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      const estExpire = expireDateOnly < nowDate

      const totalDays = planData.duree_jours || 30
      const pourcentage = totalDays > 0 ? Math.max(0, Math.min(100, (diffDays / totalDays) * 100)) : 0

      let maxCodes = planData.codes_max || 0
      if (planData.nom === 'Basique') {
        maxCodes = 2
      } else if (planData.nom === 'Premium') {
        maxCodes = 5
      }

      setPlanInfo({
        nom: planData.nom,
        expire: profileData.plan_expire,
        joursRestants: Math.max(0, diffDays),
        pourcentage: pourcentage,
        evenementsMax: planData.evenements_max || 0,
        agentsMax: planData.agents_max || 0,
        codesMax: maxCodes,
        typesTickets: planData.types_tickets || [],
        estPremium: planData.nom === 'Premium',
        estExpire: estExpire
      })
      setIsExpired(estExpire)

    } catch (error) {
      console.error('Erreur fetchPlanInfo:', error)
      setPlanInfo({
        nom: 'Erreur',
        expire: null,
        joursRestants: 0,
        pourcentage: 0,
        evenementsMax: 0,
        agentsMax: 0,
        codesMax: 0,
        typesTickets: [],
        estPremium: false,
        estExpire: true
      })
      setIsExpired(true)
    }
  }

  const fetchData = async () => {
    if (!user) return

    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('evenements')
        .select(`
          *,
          types_tickets (id, nom, prix, stock)
        `)
        .eq('organisateur_id', user.id)
        .order('created_at', { ascending: false })

      if (eventsError) throw eventsError
      setEvents(eventsData || [])

      let totalTickets = 0
      let totalRevenus = 0

      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id)
        
        const { data: ventesData, error: ventesError } = await supabase
          .from('ventes')
          .select(`
            *,
            evenement:evenements(nom, date, lieu),
            type_ticket:types_tickets(nom, prix, image_url, categorie)
          `)
          .in('evenement_id', eventIds)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!ventesError && ventesData) {
          totalTickets = ventesData.length
          totalRevenus = ventesData.reduce((sum, v) => sum + (v.montant || 0), 0)
          setVentesRecentes(ventesData || [])
        }
      }

      const { count: agentsCount, error: agentsError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('role', 'agent')

      if (agentsError) throw agentsError

      setStats({
        ticketsVendus: totalTickets,
        revenus: totalRevenus,
        evenements: eventsData?.length || 0,
        agents: agentsCount || 0
      })

    } catch (error) {
      console.error('Erreur fetchData:', error)
      throw error
    }
  }

  const fetchUnreadMessagesCount = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('organisateur_id', user.id)
        .eq('is_deleted', false)
        .eq('lu', false)
        .eq('sender', 'admin')

      if (error) throw error
      const count = data?.length || 0
      setUnreadMessagesCount(count)
    } catch (error) {
      console.error('Erreur comptage messages:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllData()
    await fetchUnreadMessagesCount()
    await fetchGatewayStatus()
    setRefreshing(false)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet événement ?')) return
    if (!confirm('Cette action est irréversible. Tous les tickets et ventes associés seront supprimés.')) return

    try {
      const { data: ticketTypes, error: ticketError } = await supabase
        .from('types_tickets')
        .select('id')
        .eq('evenement_id', eventId)

      if (ticketError) throw ticketError

      if (ticketTypes && ticketTypes.length > 0) {
        const ticketIds = ticketTypes.map(t => t.id)
        
        const { error: ventesError } = await supabase
          .from('ventes')
          .delete()
          .in('type_ticket_id', ticketIds)

        if (ventesError) {
          console.error('Erreur suppression ventes:', ventesError)
        }

        const { error: deleteTypesError } = await supabase
          .from('types_tickets')
          .delete()
          .eq('evenement_id', eventId)

        if (deleteTypesError) {
          console.error('Erreur suppression types tickets:', deleteTypesError)
          throw deleteTypesError
        }
      }

      const { error: deleteEventError } = await supabase
        .from('evenements')
        .delete()
        .eq('id', eventId)
        .eq('organisateur_id', user.id)

      if (deleteEventError) {
        if (deleteEventError.code === '409' || deleteEventError.message?.includes('violates foreign key')) {
          setError('❌ Cet événement a des dépendances (ventes, réservations). Veuillez contacter l\'administrateur.')
          setTimeout(() => setError(''), 5000)
          return
        }
        throw deleteEventError
      }

      setSuccess('✅ Événement supprimé avec succès')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur suppression:', error)
      if (error.code === '409' || error.message?.includes('violates foreign key')) {
        setError('❌ Impossible de supprimer : des données dépendent de cet événement.')
      } else {
        setError('Erreur lors de la suppression: ' + (error.message || 'Veuillez réessayer'))
      }
      setTimeout(() => setError(''), 5000)
    }
  }

  const [success, setSuccess] = useState('')

  // ============================================================
  // ENVOI WHATSAPP DIRECT - ORGANISATEUR (UNIQUEMENT)
  // ============================================================

  const handleSendWhatsApp = (vente) => {
    if (!vente.client_whatsapp) {
      setError('Numéro WhatsApp non disponible')
      setTimeout(() => setError(''), 3000)
      return
    }

    const siteUrl = window.location.origin
    // ✅ Lien direct vers le ticket (téléchargement automatique)
    const lienTelechargement = `${siteUrl}/ticket/${vente.id}`
    const nomEvenement = vente.evenement?.nom || 'N/A'
    const dateEvenement = vente.evenement?.date ? formatDate(vente.evenement.date) : 'N/A'
    const heureEvenement = vente.evenement?.date ? formatTime(vente.evenement.date) : 'N/A'
    const nomClient = vente.client_nom || 'cher client'

    const message = `Bonjour ${nomClient}, 

✅ Voici le lien de téléchargement de votre ticket pour l'événement "${nomEvenement}" du ${dateEvenement} à ${heureEvenement}.

🔗 Lien : ${lienTelechargement}

📌 Ce lien télécharge automatiquement votre ticket.

Merci pour votre achat.
🎫 FASO TICKET - Ma meilleure billetterie en ligne.`

    const numero = vente.client_whatsapp.startsWith('226') 
      ? vente.client_whatsapp 
      : `226${vente.client_whatsapp}`
    
    // ✅ Redirection directe vers WhatsApp
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, '_blank')
    
    // ✅ L'organisateur ne modifie PAS est_telecharger
    // La colonne est_telecharger reste inchangée
    
    setSuccess('✅ Lien envoyé par WhatsApp !')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleExportPDF = async () => {
    if (!planInfo.estPremium) {
      setShowUpgradeModal(true)
      return
    }
    
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default
      
      const pdfContent = document.createElement('div')
      pdfContent.style.width = '800px'
      pdfContent.style.padding = '40px'
      pdfContent.style.backgroundColor = '#000000'
      pdfContent.style.color = '#FFFFFF'
      pdfContent.style.fontFamily = 'Arial, sans-serif'
      
      pdfContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #FFD700; padding-bottom:20px; margin-bottom:20px;">
          <div>
            <h1 style="color:#FFD700; font-size:28px; font-weight:bold;">FASO TICKET</h1>
            <p style="color:#FFFFFF; font-size:12px;">La meilleure plateforme de billetterie événementielle</p>
          </div>
          <div style="color:#FFD700; font-size:14px;">${formatDateTime(new Date())}</div>
        </div>
        
        <h2 style="color:#FFD700; font-size:22px; margin-bottom:20px;">📊 Rapport des ventes</h2>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px;">
          <div style="background:#1A1A1A; padding:15px; border-radius:10px; border-left:4px solid #FFD700;">
            <p style="color:#9CA3AF; font-size:12px;">Total ventes</p>
            <p style="color:#FFD700; font-size:24px; font-weight:bold;">${stats.ticketsVendus}</p>
          </div>
          <div style="background:#1A1A1A; padding:15px; border-radius:10px; border-left:4px solid #FFD700;">
            <p style="color:#9CA3AF; font-size:12px;">Revenus totaux</p>
            <p style="color:#FFD700; font-size:24px; font-weight:bold;">${stats.revenus.toLocaleString()} FCFA</p>
          </div>
          <div style="background:#1A1A1A; padding:15px; border-radius:10px; border-left:4px solid #FFD700;">
            <p style="color:#9CA3AF; font-size:12px;">Événements</p>
            <p style="color:#FFD700; font-size:24px; font-weight:bold;">${stats.evenements}</p>
          </div>
          <div style="background:#1A1A1A; padding:15px; border-radius:10px; border-left:4px solid #FFD700;">
            <p style="color:#9CA3AF; font-size:12px;">Agents</p>
            <p style="color:#FFD700; font-size:24px; font-weight:bold;">${stats.agents}</p>
          </div>
        </div>
        
        <h3 style="color:#FFD700; font-size:18px; margin-bottom:15px;">📋 Détail des ventes</h3>
        
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#1A1A1A; border-bottom:2px solid #FFD700;">
              <th style="padding:10px; text-align:left; color:#FFD700;">Date</th>
              <th style="padding:10px; text-align:left; color:#FFD700;">Client</th>
              <th style="padding:10px; text-align:left; color:#FFD700;">Événement</th>
              <th style="padding:10px; text-align:right; color:#FFD700;">Montant</th>
              <th style="padding:10px; text-align:center; color:#FFD700;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${ventesRecentes.map(v => `
              <tr style="border-bottom:1px solid #333;">
                <td style="padding:8px; color:#9CA3AF;">${formatDate(v.created_at)}</td>
                <td style="padding:8px; color:#FFFFFF;">${v.client_nom || 'Anonyme'}</td>
                <td style="padding:8px; color:#9CA3AF;">${v.evenement?.nom || '-'}</td>
                <td style="padding:8px; text-align:right; color:#FFD700;">${v.montant?.toLocaleString() || 0} FCFA</td>
                <td style="padding:8px; text-align:center; color:#${v.statut === 'scanne' ? '22C55E' : 'EAB308'};">
                  ${v.statut === 'scanne' ? '✅ Scanné' : '⏳ En attente'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top:30px; padding-top:20px; border-top:2px solid #FFD700; text-align:center;">
          <p style="color:#9CA3AF; font-size:10px;">FASO TICKET - La meilleure plateforme de billetterie événementielle</p>
          <p style="color:#6B7280; font-size:8px; margin-top:5px;">Document généré le ${formatDateTime(new Date())}</p>
        </div>
      `
      
      document.body.appendChild(pdfContent)
      
      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#000000',
        logging: false
      })
      
      document.body.removeChild(pdfContent)
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`rapport_ventes_${new Date().toISOString().slice(0,10)}.pdf`)
      
    } catch (error) {
      console.error('Erreur export:', error)
      alert('Erreur lors de l\'export PDF')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date non définie'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return 'Date invalide'
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Date non définie'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Date invalide'
    }
  }

  const getStatusBadge = (statut) => {
    const config = {
      'en_attente': { color: 'bg-yellow-500/20 text-yellow-400', label: 'En attente' },
      'scanne': { color: 'bg-green-500/20 text-green-400', label: 'Scanné' },
      'telecharge': { color: 'bg-yellow-500/20 text-yellow-400', label: 'Téléchargé' }
    }
    const c = config[statut] || config['en_attente']
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>
  }

  // ============================================================
  // NAVIGATION VERS LE GUIDE (TOUS PEUVENT Y ACCÉDER)
  // ============================================================

  const handleActivateGateway = () => {
    navigate('/organisateur/guide-gateway')
  }

  // ============================================================
  // RENDU
  // ============================================================

  if (!loading && isExpired) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Compte expiré</h2>
          <p className="text-gray-400 text-sm mb-6">
            Votre compte a expiré le {planInfo.expire ? formatDate(planInfo.expire) : 'date inconnue'}.
            <br />Contactez l'administrateur pour le réactiver.
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
            onClick={() => navigate('/')}
            className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
          >
            Retour à l'accueil
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
          <p className="text-gray-400 mt-4">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ===== HEADER ===== */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Dashboard <span className="text-yellow-400">Organisateur</span>
                </h1>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                  title="Rafraîchir"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-yellow-400 font-semibold flex items-center gap-1">
                  <Crown className="w-4 h-4" />
                  Plan {planInfo.nom || 'Aucun'}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  {planInfo.joursRestants > 0 ? (
                    `${planInfo.joursRestants} jours restants`
                  ) : (
                    <span className="text-red-400">Expiré</span>
                  )}
                </span>
                {planInfo.estPremium && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">PREMIUM</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-gray-400 text-sm">Expiration</div>
                <div className="text-white font-semibold">
                  {planInfo.joursRestants} jours
                </div>
              </div>
              <div className="w-20 h-20 relative">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="30" stroke="#1a1a1a" strokeWidth="6" fill="none"/>
                  <circle cx="40" cy="40" r="30" stroke="#FFD700" strokeWidth="6" fill="none"
                    strokeDasharray={`${Math.min(planInfo.pourcentage, 100) / 100 * 188.5} 188.5`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-yellow-400 font-bold text-sm">
                    {Math.round(Math.min(planInfo.pourcentage, 100))}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {planInfo.expire && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-gray-400">📅 Expire le :</span>
              <span className="text-gray-300 font-medium">{formatDateTime(planInfo.expire)}</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">📋 Limites :</span>
              <span className="text-gray-300">{planInfo.evenementsMax} événements max</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300">{planInfo.agentsMax} agents max</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300">{planInfo.codesMax} codes max</span>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* ===== STATISTIQUES ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-yellow-400 text-2xl font-bold">{stats.ticketsVendus}</div>
            <div className="text-gray-400 text-sm">Tickets vendus</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-yellow-400 text-2xl font-bold">{stats.revenus.toLocaleString()} FCFA</div>
            <div className="text-gray-400 text-sm">Revenus</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-yellow-400 text-2xl font-bold">{stats.evenements}</div>
            <div className="text-gray-400 text-sm">Événements</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-yellow-400 text-2xl font-bold">{stats.agents}</div>
            <div className="text-gray-400 text-sm">Agents</div>
          </div>
        </div>

        {/* ===== BOUTONS D'ACTION ===== */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 md:gap-4 mb-8">
          <Link
            to="/organisateur/evenement/creer"
            className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
          >
            <Plus className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <span className="text-gray-300 text-xs">Nouvel événement</span>
          </Link>
          <Link
            to="/organisateur/paiement"
            className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
          >
            <CreditCard className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <span className="text-gray-300 text-xs">Config paiement</span>
          </Link>
          <Link
            to="/organisateur/agents"
            className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
          >
            <UserPlus className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <span className="text-gray-300 text-xs">Gérer les agents</span>
          </Link>
          
          {planInfo.estPremium ? (
            <Link
              to="/organisateur/statistiques"
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
            >
              <TrendingUp className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <span className="text-gray-300 text-xs">Statistiques</span>
            </Link>
          ) : (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors cursor-pointer"
            >
              <TrendingUp className="w-6 h-6 text-gray-500 mx-auto mb-1" />
              <span className="text-gray-500 text-xs">Statistiques (Premium)</span>
            </button>
          )}
          
          <Link
            to="/organisateur/codes-promo"
            className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
          >
            <Code className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <span className="text-gray-300 text-xs">Codes promo</span>
          </Link>

          {planInfo.estPremium ? (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors"
            >
              <FileSpreadsheet className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <span className="text-gray-300 text-xs">
                {exporting ? 'Export...' : 'Exporter PDF'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-6 h-6 text-gray-500 mx-auto mb-1" />
              <span className="text-gray-500 text-xs">Export PDF (Premium)</span>
            </button>
          )}

          {/* ============================================================
              BOUTON GATEWAY SMS & SCANNER - UTILISABLE PAR TOUS
              ============================================================ */}
          <button
            onClick={handleActivateGateway}
            className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors relative group"
          >
            <div className="relative">
              <Radio className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              {gatewayStatus.estActif && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-gray-300 text-xs">Gateway SMS & Scanner</span>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {gatewayLoading ? (
                '...'
              ) : gatewayStatus.estActif ? (
                <span className="text-green-400 flex items-center justify-center gap-1">
                  <Wifi className="w-3 h-3" /> Connecté
                </span>
              ) : gatewayStatus.cleExists ? (
                <span className="text-yellow-400 flex items-center justify-center gap-1">
                  <WifiOff className="w-3 h-3" /> Déconnecté
                </span>
              ) : (
                <span className="text-gray-500">Non configuré</span>
              )}
            </div>
            {!planInfo.estPremium ? (
              <div className="text-[8px] text-gray-500 mt-0.5">
                🔑 1 clé max
              </div>
            ) : (
              <div className="text-[8px] text-yellow-400 mt-0.5">
                ⭐ Clés illimitées
              </div>
            )}
          </button>

          {/* Messagerie */}
          {planInfo.estPremium ? (
            <Link
              to="/organisateur/messagerie"
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors relative"
            >
              <MessageSquare className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <span className="text-gray-300 text-xs">Messagerie</span>
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
            </Link>
          ) : (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gray-900 hover:bg-gray-800 p-4 rounded-xl border border-gray-800 text-center transition-colors cursor-pointer"
            >
              <MessageSquare className="w-6 h-6 text-gray-500 mx-auto mb-1" />
              <span className="text-gray-500 text-xs">Messagerie (Premium)</span>
            </button>
          )}
        </div>

        {/* ===== LISTE DES ÉVÉNEMENTS ===== */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-8">
          <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-white font-semibold">Mes événements ({events.length})</h2>
            <Link
              to="/organisateur/evenement/creer"
              className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Créer
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Vous n'avez pas encore créé d'événement</p>
              <Link
                to="/organisateur/evenement/creer"
                className="inline-block mt-4 bg-yellow-400 text-black px-6 py-2 rounded-lg hover:bg-yellow-300 transition-colors text-sm font-medium"
              >
                Créer mon premier événement
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Événement</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden sm:table-cell">Date</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">Lieu</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden lg:table-cell">Tickets</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white text-sm font-medium">{event.nom}</p>
                          <p className="text-gray-500 text-xs">{event.types_tickets?.length || 0} types de tickets</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden sm:table-cell">
                        {formatDateTime(event.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                        {event.lieu}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell">
                        {event.types_tickets?.reduce((sum, t) => sum + (t.stock || 0), 0) || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/boutique/${event.id}`}
                            className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                            title="Voir"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          
                          {planInfo.estPremium ? (
                            <Link
                              to={`/organisateur/evenement/modifier/${event.id}`}
                              className="text-yellow-400 hover:text-yellow-300 transition-colors p-1"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          ) : (
                            <button
                              onClick={() => setShowUpgradeModal(true)}
                              className="text-gray-500 hover:text-yellow-400 transition-colors p-1"
                              title="Passer au Premium pour modifier"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== DERNIÈRES VENTES (UNIQUEMENT WHATSAPP) ===== */}
        {planInfo.estPremium && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-white font-semibold">Dernières ventes</h2>
              <Link to="/organisateur/statistiques" className="text-yellow-400 hover:text-yellow-300 text-sm">
                Voir détails →
              </Link>
            </div>
            
            {ventesRecentes.length === 0 ? (
              <div className="p-8 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Aucune vente pour le moment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Acheteur</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">WhatsApp</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden lg:table-cell">Événement</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Montant</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Statut</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Téléchargé</th>
                      <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventesRecentes.map((vente) => (
                      <tr key={vente.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                          {formatDateTime(vente.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white text-sm">
                          {vente.client_nom || 'Anonyme'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                          {vente.client_whatsapp || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell max-w-[120px] truncate">
                          {vente.evenement?.nom || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm hidden sm:table-cell">
                          {vente.type_ticket?.nom || '-'}
                        </td>
                        <td className="px-4 py-3 text-yellow-400 text-sm font-medium whitespace-nowrap">
                          {vente.montant?.toLocaleString()} FCFA
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(vente.statut)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${
                            vente.est_telecharger ? 'text-green-400' : 'text-gray-500'
                          }`}>
                            {vente.est_telecharger ? '✅ Oui' : '❌ Non'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* ===== UNIQUEMENT WHATSAPP (PAS DE TÉLÉCHARGEMENT) ===== */}
                            {vente.client_whatsapp && (
                              <button
                                onClick={() => handleSendWhatsApp(vente)}
                                className="text-gray-400 hover:text-green-400 transition-colors p-1"
                                title="Envoyer le lien par WhatsApp"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL UPGRADE PREMIUM ===== */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Passer au Premium</h3>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                <p className="text-white font-semibold">Plan Premium</p>
                <p className="text-gray-400 text-sm">50 000 FCFA / 3 mois</p>
              </div>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Modifier vos événements
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Jusqu'à 10 événements
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Jusqu'à 5 agents
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Statistiques avancées
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Codes promo illimités
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Export PDF des ventes
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Messagerie avec l'administration
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-yellow-400 font-medium">📱 Gateway SMS & Scanner (clés illimitées)</span>
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-yellow-400 font-medium">👥 Supervision des agents en temps réel</span>
                </li>
                <li className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-yellow-400 font-medium">🔄 Génération illimitée de clés d'association</span>
                </li>
              </ul>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-yellow-400 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Contactez l'administrateur pour passer au plan Premium
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="https://wa.me/22607396519"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  WhatsApp : 07 396 519
                </a>
                <a
                  href="mailto:fasoticket.burkindi@gmail.com"
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  fasoticket.burkindi@gmail.com
                </a>
              </div>

              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardOrganisateur