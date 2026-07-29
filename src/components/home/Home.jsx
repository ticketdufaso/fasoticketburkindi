/**
 * Page d'accueil - FASO TICKET
 * Règles NASA 1, 4, 5, 6, 7
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Suppression de la section "Nos partenaires"
 * - Section "Nos sponsors" en bas, juste avant le footer
 * - Sponsors en cercle (format rond)
 * - Boutons : Acheter, Réserver, Devenir organisateur, Connexion
 * - Vérification du stock pour chaque événement (bouton "Voir" grisé si stock = 0)
 * - Affichage "COMPLET" sur les cartes d'événements épuisés
 * - Mise à jour en temps réel via Supabase Realtime
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  Calendar, 
  Users, 
  Ticket, 
  Star, 
  MapPin, 
  Clock, 
  Shield, 
  Zap, 
  Smartphone, 
  Award,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  ThumbsUp,
  Send,
  RefreshCw,
  ExternalLink,
  Building2,
  ChevronRight,
  LogIn
} from 'lucide-react'

const Home = () => {
  // État des événements
  const [evenements, setEvenements] = useState([])
  const [commentaires, setCommentaires] = useState([])
  
  // État des sponsors
  const [sponsors, setSponsors] = useState([])
  const [visibleSponsors, setVisibleSponsors] = useState(6)
  
  // État du formulaire de commentaire
  const [newComment, setNewComment] = useState({ 
    nom: '', 
    note: 5, 
    commentaire: '' 
  })
  
  // États de chargement
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [visibleComments, setVisibleComments] = useState(6)
  
  // État pour les stocks des événements
  const [stockData, setStockData] = useState({})

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError('')

      // 1. Récupérer les événements à la une (Premium)
      const { data: premiumOrganisateurs, error: premiumError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'organisateur')
        .eq('plan_id', 'Premium')
        .eq('statut', true)

      const premiumIds = premiumOrganisateurs?.map(o => o.id) || []

      if (premiumIds.length > 0) {
        const { data: events, error: eventsFetchError } = await supabase
          .from('evenements')
          .select(`
            *,
            organisateur:profiles(structure, plan_id),
            types_tickets (id, nom, prix, stock)
          `)
          .eq('actif', true)
          .in('organisateur_id', premiumIds)
          .order('date', { ascending: true })
          .limit(12)

        if (!eventsFetchError && events) {
          // Calculer le stock total pour chaque événement
          const stockMap = {}
          events.forEach(event => {
            const totalStock = event.types_tickets?.reduce((sum, t) => sum + (t.stock || 0), 0) || 0
            stockMap[event.id] = totalStock
          })
          setStockData(stockMap)
          setEvenements(events)
        }
      }

      // 2. Récupérer les commentaires
      const { data: allComments, error: commentsError } = await supabase
        .from('commentaires')
        .select(`
          *,
          reponses:reponses_avis(*)
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!commentsError && allComments && allComments.length > 0) {
        const commentairesVisibles = allComments.filter(comment => {
          if (!comment.statut) return true
          const statutLower = comment.statut.toLowerCase().trim()
          const statutsExclus = ['supprime', 'rejete', 'rejeté']
          return !statutsExclus.includes(statutLower)
        })
        setCommentaires(commentairesVisibles)
      } else {
        setCommentaires([])
      }

      // 3. Récupérer les sponsors actifs
      const { data: sponsorsData, error: sponsorsError } = await supabase
        .from('sponsors')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })

      if (!sponsorsError && sponsorsData) {
        const sponsorsAvecLien = sponsorsData.map(sponsor => {
          let lien = sponsor.lien || ''
          if (lien && !lien.startsWith('http://') && !lien.startsWith('https://')) {
            lien = `https://${lien}`
          }
          return { ...sponsor, lien }
        })
        setSponsors(sponsorsAvecLien)
      } else {
        setSponsors([])
      }

    } catch (err) {
      console.error('❌ Erreur générale fetchData:', err)
      setError('Erreur de chargement des données. Veuillez rafraîchir la page.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    fetchData(true)
  }

  const loadMoreSponsors = () => {
    setVisibleSponsors(prev => prev + 6)
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const nomTrimmed = newComment.nom.trim()
    if (!nomTrimmed || nomTrimmed.length < 2) {
      setError('Veuillez entrer votre nom (minimum 2 caractères)')
      return
    }

    if (nomTrimmed.length > 100) {
      setError('Le nom ne doit pas dépasser 100 caractères')
      return
    }

    console.assert(newComment.note >= 1 && newComment.note <= 5, 'Note invalide')

    if (newComment.commentaire && newComment.commentaire.length > 1000) {
      setError('Le commentaire ne doit pas dépasser 1000 caractères')
      return
    }

    setSubmitting(true)

    try {
      const commentData = {
        nom: nomTrimmed,
        note: newComment.note,
        commentaire: newComment.commentaire.trim() || null,
        statut: 'visible'
      }

      const { data, error } = await supabase
        .from('commentaires')
        .insert([commentData])
        .select()

      if (error) {
        console.error('❌ Erreur insertion:', error)
        throw error
      }

      setSuccess('✅ Merci ! Votre avis est visible immédiatement.')
      setNewComment({ nom: '', note: 5, commentaire: '' })
      
      await fetchData(true)
      
      setTimeout(() => setSuccess(''), 5000)

    } catch (err) {
      console.error('❌ Erreur complète:', err)
      
      let errorMessage = 'Erreur lors de l\'envoi. '
      
      if (err.code === '23514') {
        errorMessage += 'Valeur invalide pour un champ. Vérifiez la note (1-5).'
      } else if (err.code === '23502') {
        errorMessage += 'Certains champs obligatoires sont manquants.'
      } else {
        errorMessage += err.message || 'Veuillez réessayer.'
      }
      
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr) => {
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

  const renderStars = (note) => {
    const stars = []
    const noteRounded = Math.round(note)
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= noteRounded ? 'text-yellow-400' : 'text-gray-600'}>
          ★
        </span>
      )
    }
    return stars
  }

  const loadMoreComments = () => {
    setVisibleComments(prev => prev + 6)
  }

  const displayedComments = commentaires.slice(0, visibleComments)
  const displayedSponsors = sponsors.slice(0, visibleSponsors)

  const getTotalStock = (eventId) => {
    return stockData[eventId] || 0
  }

  const isEventAvailable = (eventId) => {
    return getTotalStock(eventId) > 0
  }

  useEffect(() => {
    fetchData()

    const subscription = supabase
      .channel('home_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'commentaires' },
        () => {
          fetchData(true)
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'commentaires' },
        () => {
          fetchData(true)
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sponsors' },
        () => {
          fetchData(true)
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'evenements' },
        () => {
          fetchData(true)
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'types_tickets' },
        () => {
          fetchData(true)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchData, refreshKey])

  return (
    <div className="min-h-screen bg-black">
      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight animate-fade-in">
            <span className="text-white">FASO</span>
            <span className="text-yellow-400">TICKET</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg md:text-xl mt-4 max-w-2xl mx-auto animate-fade-in">
            La billetterie simple, rapide et sécurisée pour vos événements au Burkina Faso
          </p>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8 md:mt-12 max-w-3xl mx-auto animate-slide-up">
            <Link
              to="/boutique"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center space-x-2 text-sm md:text-base shadow-lg hover:shadow-yellow-400/25"
            >
              <Ticket className="w-4 h-4 md:w-5 md:h-5" />
              <span>Acheter un ticket</span>
            </Link>
            <Link
              to="/reservation"
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center space-x-2 border border-gray-700 text-sm md:text-base"
            >
              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              <span>Réserver un ticket</span>
            </Link>
            <Link
              to="/devenir-organisateur"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center space-x-2 text-sm md:text-base shadow-lg hover:shadow-red-600/25"
            >
              <Users className="w-4 h-4 md:w-5 md:h-5" />
              <span>Devenir organisateur</span>
            </Link>
            <Link
              to="/connexion"
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center space-x-2 border border-gray-600 text-sm md:text-base"
            >
              <LogIn className="w-4 h-4 md:w-5 md:h-5" />
              <span>Connexion</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== AVANTAGES ===== */}
      <section className="py-12 md:py-16 px-4 border-t border-yellow-400/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8 md:mb-12">
            Pourquoi <span className="text-yellow-400">FASO TICKET</span> ?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800 hover:border-yellow-400/30 transition-all">
              <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-white font-semibold text-sm md:text-base">0% frais cachés</div>
              <div className="text-gray-500 text-xs mt-1">Prix transparents</div>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800 hover:border-yellow-400/30 transition-all">
              <Shield className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-white font-semibold text-sm md:text-base">100% sécurisé</div>
              <div className="text-gray-500 text-xs mt-1">Paiement mobile</div>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800 hover:border-yellow-400/30 transition-all">
              <Smartphone className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-white font-semibold text-sm md:text-base">24/7 disponible</div>
              <div className="text-gray-500 text-xs mt-1">Accès permanent</div>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800 hover:border-yellow-400/30 transition-all">
              <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-white font-semibold text-sm md:text-base">Ticket immédiat</div>
              <div className="text-gray-500 text-xs mt-1">Génération instantanée</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ÉVÉNEMENTS À LA UNE ===== */}
      <section className="py-12 md:py-16 px-4 border-t border-yellow-400/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
            <h2 className="text-2xl md:text-4xl font-bold text-white">
              Événements <span className="text-yellow-400">à la une</span>
            </h2>
            <Link 
              to="/boutique" 
              className="text-yellow-400 hover:text-yellow-300 font-medium text-sm md:text-base transition-colors flex items-center gap-1"
            >
              Voir tout 
              <span className="text-lg">→</span>
            </Link>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse border border-gray-800">
                  <div className="w-full h-48 bg-gray-800 rounded-lg"></div>
                  <div className="h-6 bg-gray-800 rounded mt-4 w-3/4"></div>
                  <div className="h-4 bg-gray-800 rounded mt-2 w-1/2"></div>
                </div>
              ))}
            </div>
          ) : evenements.length === 0 ? (
            <div className="text-center py-16 md:py-20">
              <Calendar className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-base md:text-lg">Aucun événement à la une pour le moment</p>
              <p className="text-gray-500 text-sm mt-2">Revenez plus tard pour découvrir de nouveaux événements</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {evenements.map((event) => {
                const totalStock = getTotalStock(event.id)
                const isAvailable = totalStock > 0
                
                return (
                  <div 
                    key={event.id} 
                    className="bg-gray-900 rounded-xl overflow-hidden hover:transform hover:scale-[1.02] transition-all duration-300 border border-gray-800 hover:border-yellow-400/30"
                  >
                    <div className="relative">
                      <img
                        src={event.affiche_url || '/images/default-event.jpg'}
                        alt={event.nom}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = '/images/default-event.jpg'
                          e.target.onerror = null
                        }}
                      />
                      {event.types_tickets && event.types_tickets.length > 0 && (
                        <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                          {totalStock} places
                        </div>
                      )}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            COMPLET
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-semibold text-base md:text-lg truncate">{event.nom}</h3>
                      <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{formatDate(event.date)}</span>
                      </p>
                      <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{event.lieu}</span>
                      </p>
                      {event.organisateur && (
                        <p className="text-gray-500 text-xs mt-1">{event.organisateur.structure}</p>
                      )}
                      <div className="flex flex-wrap gap-1 md:gap-2 mt-2 md:mt-3">
                        {event.types_tickets && event.types_tickets.slice(0, 3).map((type) => (
                          <span key={type.id} className="bg-gray-800 text-gray-300 text-[10px] md:text-xs px-2 py-1 rounded">
                            {type.nom}: {type.prix?.toLocaleString()} FCFA
                          </span>
                        ))}
                        {event.types_tickets && event.types_tickets.length > 3 && (
                          <span className="text-gray-500 text-xs">+{event.types_tickets.length - 3}</span>
                        )}
                      </div>
                      
                      {/* ===== BOUTON "VOIR" AVEC GESTION DU STOCK ===== */}
                      {isAvailable ? (
                        <Link
                          to={`/boutique/${event.id}`}
                          className="block mt-3 md:mt-4 bg-yellow-400 hover:bg-yellow-300 text-black text-center font-medium py-2 rounded-lg transition-colors text-sm md:text-base"
                        >
                          Voir
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="block mt-3 md:mt-4 bg-gray-700 text-gray-400 text-center font-medium py-2 rounded-lg cursor-not-allowed text-sm md:text-base w-full"
                        >
                          Complet
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== SPONSORS - DERNIÈRE SECTION AVANT LE FOOTER ===== */}
      <section className="py-12 md:py-16 px-4 bg-gray-900/30 border-t border-yellow-400/10 border-b border-yellow-400/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <h2 className="text-2xl md:text-4xl font-bold text-white">
              Nos <span className="text-yellow-400">sponsors</span>
            </h2>
            {sponsors.length > visibleSponsors && (
              <button
                onClick={loadMoreSponsors}
                className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium flex items-center gap-1"
              >
                Voir plus
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : sponsors.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Aucun sponsor pour le moment</p>
              <p className="text-sm text-gray-500">Revenez plus tard</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              {displayedSponsors.map((sponsor) => (
                <a
                  key={sponsor.id}
                  href={sponsor.lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center transition-all duration-300 hover:transform hover:scale-110"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gray-800 border-2 border-gray-700 group-hover:border-yellow-400/50 transition-all duration-300 flex items-center justify-center overflow-hidden p-2">
                    {sponsor.image_url ? (
                      <img
                        src={sponsor.image_url}
                        alt={sponsor.nom}
                        className="w-full h-full object-contain rounded-full"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = '/images/default-sponsor.png'
                          e.target.onerror = null
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                        <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <p className="text-white text-xs sm:text-sm font-medium mt-2 group-hover:text-yellow-400 transition-colors text-center max-w-[80px] truncate">
                    {sponsor.nom}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== COMMENTAIRES ===== */}
      <section className="py-12 md:py-16 px-4 border-t border-yellow-400/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-white text-center mb-8 md:mb-12">
            Ce que nos <span className="text-yellow-400">clients</span> disent
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Formulaire */}
            <div className="bg-gray-900 rounded-xl p-4 md:p-6 border border-gray-800">
              <h3 className="text-white font-semibold text-lg mb-4">Donnez votre avis</h3>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg mb-4 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmitComment}>
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-1">
                    Votre nom <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newComment.nom}
                    onChange={(e) => setNewComment({ ...newComment, nom: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="Nom complet"
                    required
                    minLength="2"
                    maxLength="100"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-1">
                    Note <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-1 md:gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewComment({ ...newComment, note: star })}
                        className={`text-2xl md:text-3xl transition-colors ${
                          star <= newComment.note ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
                        }`}
                        aria-label={`Note ${star} étoiles`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-1">Commentaire (facultatif)</label>
                  <textarea
                    value={newComment.commentaire}
                    onChange={(e) => setNewComment({ ...newComment, commentaire: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 transition-colors resize-none"
                    rows="3"
                    placeholder="Votre avis..."
                    maxLength="1000"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer mon avis
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* ===== LISTE DES COMMENTAIRES ===== */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="text-center py-10 text-gray-400">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p>Chargement des avis...</p>
                </div>
              ) : commentaires.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-900 rounded-xl border border-gray-800">
                  <Star className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Aucun avis pour le moment</p>
                  <p className="text-sm text-gray-500">Soyez le premier à donner votre avis !</p>
                </div>
              ) : (
                <>
                  {displayedComments.map((c) => (
                    <div key={c.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-yellow-400/30 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-white font-semibold">{c.nom}</span>
                          <div className="flex text-yellow-400 text-sm mt-1">
                            {renderStars(c.note)}
                          </div>
                        </div>
                        <span className="text-gray-500 text-xs">
                          {new Date(c.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      {c.commentaire && (
                        <p className="text-gray-300 mt-2 text-sm">{c.commentaire}</p>
                      )}
                      {c.reponses && c.reponses.length > 0 && (
                        <div className="mt-3 ml-2 bg-gray-800/50 rounded-lg p-3 border-l-2 border-yellow-400">
                          {c.reponses.map((r) => (
                            <div key={r.id}>
                              <div className="flex items-center gap-2">
                                <ThumbsUp className="w-3 h-3 text-yellow-400" />
                                <span className="text-yellow-400 text-xs font-medium">Réponse de l'administrateur</span>
                              </div>
                              <p className="text-gray-300 text-sm mt-1">{r.reponse}</p>
                              <span className="text-gray-500 text-[10px]">
                                {new Date(r.created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {commentaires.length > visibleComments && (
                    <div className="text-center pt-2">
                      <button
                        onClick={loadMoreComments}
                        className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium"
                      >
                        Voir plus ({commentaires.length - visibleComments} avis restants)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FFD700;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e6c200;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default Home