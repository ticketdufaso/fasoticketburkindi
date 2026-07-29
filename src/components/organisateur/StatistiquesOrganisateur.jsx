/**
 * Statistiques Organisateur - Version complète
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - ✅ Vérification Premium (accès bloqué pour Basique)
 * - ✅ Suppression du bouton "Télécharger" pour l'organisateur
 * - ✅ Conservation UNIQUEMENT du bouton "Envoyer par WhatsApp"
 * - ✅ Lien WhatsApp avec ?download=true pour téléchargement automatique
 * - ✅ Statuts corrigés (en_attente, scanne)
 * - ✅ Organisateur Premium peut retélécharger
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  TrendingUp, Download, Send, Eye, Search, Filter,
  Calendar, Clock, User, Phone, Ticket, DollarSign,
  CheckCircle, XCircle, AlertCircle, Loader, RefreshCw,
  ArrowLeft, BarChart3, PieChart, ChevronDown, ChevronUp,
  Tag, Percent, ShoppingBag, Crown, Lock, Mail, 
  Zap, Phone as PhoneIcon
} from 'lucide-react'

const StatistiquesOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ventes, setVentes] = useState([])
  const [events, setEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('tous')
  const [filterEvent, setFilterEvent] = useState('tous')
  const [downloading, setDownloading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    revenus: 0,
    enAttente: 0,
    scanne: 0,
    telecharge: 0,
    avecPromo: {
      count: 0,
      revenus: 0
    },
    sansPromo: {
      count: 0,
      revenus: 0
    }
  })
  const [visibleCount, setVisibleCount] = useState(20)
  const [refreshKey, setRefreshKey] = useState(0)

  // ============================================================
  // VÉRIFICATION PREMIUM
  // ============================================================
  useEffect(() => {
    const checkPlan = async () => {
      try {
        setCheckingPremium(true)
        setError('')
        
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('plan_id')
          .eq('id', user.id)
          .single()
        
        if (profileError) throw profileError
        
        if (data && data.plan_id === 'Premium') {
          setIsPremium(true)
        } else {
          setIsPremium(false)
        }
      } catch (error) {
        console.error('Erreur vérification plan:', error)
        setError('Erreur lors de la vérification du plan')
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
  // CHARGEMENT DES DONNÉES (UNIQUEMENT SI PREMIUM)
  // ============================================================
  useEffect(() => {
    if (user && isPremium) {
      fetchData()
    }
  }, [user, isPremium, refreshKey])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('📊 Chargement des statistiques...')

      // 1. Récupérer les événements
      const { data: eventsData, error: eventsError } = await supabase
        .from('evenements')
        .select('id, nom')
        .eq('organisateur_id', user.id)
        .eq('actif', true)

      if (eventsError) {
        console.error('❌ Erreur événements:', eventsError)
        throw eventsError
      }
      
      setEvents(eventsData || [])
      console.log('✅ Événements chargés:', eventsData?.length || 0)

      // 2. Récupérer les ventes
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

        if (ventesError) {
          console.error('❌ Erreur ventes:', ventesError)
          throw ventesError
        }

        setVentes(ventesData || [])
        console.log('✅ Ventes chargées:', ventesData?.length || 0)

        // 3. Calculer les statistiques
        calculateStats(ventesData || [])
        
      } else {
        setVentes([])
        setStats({
          total: 0,
          revenus: 0,
          enAttente: 0,
          scanne: 0,
          telecharge: 0,
          avecPromo: { count: 0, revenus: 0 },
          sansPromo: { count: 0, revenus: 0 }
        })
        console.log('📊 Aucun événement trouvé')
      }

    } catch (error) {
      console.error('❌ Erreur fetchData:', error)
      setError('Erreur lors du chargement des données: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (ventesData) => {
    try {
      const total = ventesData.length
      const revenus = ventesData.reduce((sum, v) => sum + (v.montant || 0), 0)
      const enAttente = ventesData.filter(v => v.statut === 'en_attente').length
      const scanne = ventesData.filter(v => v.statut === 'scanne').length
      const telecharge = ventesData.filter(v => v.statut === 'telecharge').length

      const ventesAvecPromo = ventesData.filter(v => v.code_promo_id !== null)
      const ventesSansPromo = ventesData.filter(v => v.code_promo_id === null)

      const avecPromoCount = ventesAvecPromo.length
      const avecPromoRevenus = ventesAvecPromo.reduce((sum, v) => sum + (v.montant || 0), 0)

      const sansPromoCount = ventesSansPromo.length
      const sansPromoRevenus = ventesSansPromo.reduce((sum, v) => sum + (v.montant || 0), 0)

      setStats({
        total,
        revenus,
        enAttente,
        scanne,
        telecharge,
        avecPromo: {
          count: avecPromoCount,
          revenus: avecPromoRevenus
        },
        sansPromo: {
          count: sansPromoCount,
          revenus: sansPromoRevenus
        }
      })
      
      console.log('📊 Statistiques calculées:', { total, revenus, enAttente, scanne, telecharge })
    } catch (error) {
      console.error('❌ Erreur calcul stats:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1)
  }

  // ============================================================
  // STATUS BADGE
  // ============================================================
  const getStatusBadge = (statut) => {
    const config = {
      'en_attente': { color: 'bg-yellow-500/20 text-yellow-400', label: 'En attente', icon: <Clock className="w-3 h-3" /> },
      'scanne': { color: 'bg-green-500/20 text-green-400', label: 'Scanné', icon: <CheckCircle className="w-3 h-3" /> },
      'telecharge': { color: 'bg-yellow-500/20 text-yellow-400', label: 'Téléchargé', icon: <Download className="w-3 h-3" /> }
    }
    const c = config[statut] || config['en_attente']
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
        {c.icon}
        {c.label}
      </span>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
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
      return ''
    }
  }

  const formatDateShort = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return ''
    }
  }

  // ============================================================
  // ENVOI WHATSAPP - UNIQUEMENT (PAS DE TÉLÉCHARGEMENT)
  // ============================================================
  const handleSendWhatsApp = (vente) => {
    if (!vente.client_whatsapp) {
      setError('Numéro WhatsApp non disponible')
      setTimeout(() => setError(''), 3000)
      return
    }

    const siteUrl = window.location.origin
    // ✅ Lien direct avec ?download=true pour téléchargement automatique
    const lienTelechargement = `${siteUrl}/ticket/${vente.id}?download=true`
    const nomEvenement = vente.evenement?.nom || 'N/A'
    const dateEvenement = vente.evenement?.date ? formatDateShort(vente.evenement.date) : 'N/A'
    const heureEvenement = vente.evenement?.date ? new Date(vente.evenement.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
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
    
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const filteredVentes = ventes.filter(v => {
    const matchSearch = v.client_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        v.client_whatsapp?.includes(searchTerm) ||
                        v.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'tous' || v.statut === filterStatus
    const matchEvent = filterEvent === 'tous' || v.evenement_id === filterEvent
    return matchSearch && matchStatus && matchEvent
  })

  const displayedVentes = filteredVentes.slice(0, visibleCount)

  const loadMore = () => {
    setVisibleCount(prev => prev + 20)
  }

  // ============================================================
  // RENDU : VÉRIFICATION PREMIUM
  // ============================================================
  if (checkingPremium) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
        <p className="text-gray-400 ml-4">Vérification du plan...</p>
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
            Les statistiques sont disponibles uniquement pour les utilisateurs du plan Premium.
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
              <PhoneIcon className="w-5 h-5" />
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

  // ============================================================
  // RENDU : STATISTIQUES (UNIQUEMENT PREMIUM)
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
        <p className="text-gray-400 ml-4">Chargement des statistiques...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/organisateur/dashboard')}
            className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              <span className="text-yellow-400">Statistiques</span> des ventes
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-medium">Plan Premium</span>
              {error && (
                <span className="text-red-400 text-sm ml-4">⚠️ {error}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraîchir
          </button>
        </div>

        {/* ============================================================
            STATISTIQUES GLOBALES
            ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.total}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Total ventes</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.revenus.toLocaleString()} FCFA</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Revenus totaux</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-yellow-500/20 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.enAttente}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">En attente</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-green-500/20 text-center">
            <div className="text-green-400 text-xl font-bold">{stats.scanne}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Scannés</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-yellow-500/20 text-center">
            <div className="text-yellow-400 text-xl font-bold">{stats.telecharge}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Téléchargés</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <div className="text-gray-400 text-xl font-bold">{ventes.length}</div>
            <div className="text-gray-400 text-[10px] md:text-xs">Total enregistré</div>
          </div>
        </div>

        {/* ============================================================
            STATISTIQUES AVEC/SANS CODE PROMO
            ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-5 h-5 text-yellow-400" />
              <h3 className="text-white font-semibold">Avec code promo</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-yellow-400 text-2xl font-bold">{stats.avecPromo.count}</div>
                <div className="text-gray-400 text-xs">Nombre de tickets</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-yellow-400 text-2xl font-bold">{stats.avecPromo.revenus.toLocaleString()} FCFA</div>
                <div className="text-gray-400 text-xs">Revenus totaux</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-5 h-5 text-green-400" />
              <h3 className="text-white font-semibold">Sans code promo</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-green-400 text-2xl font-bold">{stats.sansPromo.count}</div>
                <div className="text-gray-400 text-xs">Nombre de tickets</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-green-400 text-2xl font-bold">{stats.sansPromo.revenus.toLocaleString()} FCFA</div>
                <div className="text-gray-400 text-xs">Revenus totaux</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher par nom, WhatsApp, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="scanne">Scannés</option>
            <option value="telecharge">Téléchargés</option>
          </select>
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
          >
            <option value="tous">Tous les événements</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tableau des ventes */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {filteredVentes.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Aucune vente trouvée</p>
              <p className="text-sm text-gray-500">Les ventes de vos événements apparaîtront ici</p>
              {error && <p className="text-red-400 text-sm mt-2">⚠️ {error}</p>}
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
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Code Promo</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Statut</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Téléchargé</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedVentes.map((vente) => (
                    <tr key={vente.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                        {formatDate(vente.created_at)}
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
                        {vente.code_promo_id ? (
                          <span className="text-yellow-400 text-xs font-medium">✅ Oui</span>
                        ) : (
                          <span className="text-gray-500 text-xs">❌ Non</span>
                        )}
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
                              title="Envoyer le lien de téléchargement par WhatsApp"
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

          {filteredVentes.length > visibleCount && (
            <div className="p-4 text-center border-t border-gray-800">
              <button
                onClick={loadMore}
                className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                Voir plus ({filteredVentes.length - visibleCount} restants)
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default StatistiquesOrganisateur