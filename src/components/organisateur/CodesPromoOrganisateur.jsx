/**
 * Codes Promo - Organisateur
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Limite : Basique = 2 codes, Premium = 5 codes
 * - Affichage des limites dans l'UI
 * - SUPPRESSION DU BOUTON SUPPRIMER (l'organisateur ne peut pas supprimer)
 * - Activation/Désactivation uniquement (soft delete)
 * - Désactivation automatique quand limite d'utilisations atteinte (trigger SQL)
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Code, Plus, Loader, RefreshCw,
  Search, CheckCircle, AlertCircle,
  ArrowLeft, Calendar, Percent,
  Eye, EyeOff, Tag, Link, Users, Zap, Ticket
} from 'lucide-react'

const CodesPromoOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [codes, setCodes] = useState([])
  const [events, setEvents] = useState([])
  const [ticketTypes, setTicketTypes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('tous')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [planInfo, setPlanInfo] = useState({ 
    codesMax: 0,
    planNom: ''
  })

  const [formData, setFormData] = useState({
    code: '',
    type: 'pourcentage',
    valeur: '',
    evenement_id: '',
    type_ticket_ids: [],
    date_debut: '',
    date_fin: '',
    quantite_max: ''
  })

  // Chargement des types de tickets pour un événement sélectionné
  useEffect(() => {
    if (formData.evenement_id) {
      fetchTicketTypes(formData.evenement_id)
    } else {
      fetchAllTicketTypes()
    }
  }, [formData.evenement_id])

  useEffect(() => {
    if (user) {
      fetchCodes()
      fetchEvents()
      fetchPlanInfo()
    }
  }, [user])

  // ============================================================
  // PLAN INFO AVEC LIMITES (Basique=2, Premium=5)
  // ============================================================
  const fetchPlanInfo = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_id')
        .eq('id', user.id)
        .single()

      if (profileData && profileData.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('codes_max, nom')
          .eq('nom', profileData.plan_id)
          .single()

        if (planData) {
          let maxCodes = planData.codes_max || 0
          if (planData.nom === 'Basique') {
            maxCodes = 2
          } else if (planData.nom === 'Premium') {
            maxCodes = 5
          }
          setPlanInfo({ 
            codesMax: maxCodes,
            planNom: planData.nom
          })
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('evenements')
        .select('id, nom')
        .eq('organisateur_id', user.id)
        .eq('actif', true)
        .order('nom', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchTicketTypes = async (eventId) => {
    try {
      const { data, error } = await supabase
        .from('types_tickets')
        .select('id, nom, categorie')
        .eq('evenement_id', eventId)
        .order('nom', { ascending: true })

      if (error) throw error
      setTicketTypes(data || [])
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchAllTicketTypes = async () => {
    try {
      const { data: eventsData } = await supabase
        .from('evenements')
        .select('id')
        .eq('organisateur_id', user.id)
        .eq('actif', true)

      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id)
        const { data, error } = await supabase
          .from('types_tickets')
          .select('id, nom, categorie, evenement_id')
          .in('evenement_id', eventIds)
          .order('nom', { ascending: true })

        if (error) throw error
        setTicketTypes(data || [])
      } else {
        setTicketTypes([])
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchCodes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('codes_promo')
        .select(`
          *,
          evenement:evenements(nom)
        `)
        .eq('organisateur_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const codesWithTypes = await Promise.all((data || []).map(async (code) => {
        if (code.type_ticket_ids && code.type_ticket_ids.length > 0) {
          const { data: types } = await supabase
            .from('types_tickets')
            .select('nom, categorie')
            .in('id', code.type_ticket_ids)
          
          return {
            ...code,
            type_tickets_details: types || []
          }
        }
        return {
          ...code,
          type_tickets_details: []
        }
      }))

      setCodes(codesWithTypes || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // ============================================================
  // AJOUT CODE PROMO
  // ============================================================
  const handleAddCode = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!formData.code || formData.code.length < 3) {
      setError('Le code doit contenir au moins 3 caractères')
      setSubmitting(false)
      return
    }
    if (!formData.valeur || parseInt(formData.valeur) <= 0) {
      setError('Valeur invalide')
      setSubmitting(false)
      return
    }
    if (!formData.date_debut) {
      setError('Date de début requise')
      setSubmitting(false)
      return
    }
    if (!formData.date_fin) {
      setError('Date de fin requise')
      setSubmitting(false)
      return
    }
    if (new Date(formData.date_fin) <= new Date(formData.date_debut)) {
      setError('La date de fin doit être après la date de début')
      setSubmitting(false)
      return
    }

    if (codes.length >= planInfo.codesMax) {
      setError(`Vous avez atteint la limite de ${planInfo.codesMax} codes pour votre plan ${planInfo.planNom}`)
      setSubmitting(false)
      return
    }

    const { data: existing } = await supabase
      .from('codes_promo')
      .select('id')
      .eq('code', formData.code.toUpperCase())
      .single()

    if (existing) {
      setError('Ce code promo existe déjà')
      setSubmitting(false)
      return
    }

    try {
      const { error } = await supabase
        .from('codes_promo')
        .insert([{
          organisateur_id: user.id,
          code: formData.code.toUpperCase(),
          type: formData.type,
          valeur: parseInt(formData.valeur),
          evenement_id: formData.evenement_id || null,
          type_ticket_ids: formData.type_ticket_ids && formData.type_ticket_ids.length > 0 ? formData.type_ticket_ids : null,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin,
          quantite_max: formData.quantite_max ? parseInt(formData.quantite_max) : 0,
          actif: true
        }])

      if (error) throw error

      setSuccess('Code promo créé avec succès !')
      setShowAddModal(false)
      setFormData({ code: '', type: 'pourcentage', valeur: '', evenement_id: '', type_ticket_ids: [], date_debut: '', date_fin: '', quantite_max: '' })
      await fetchCodes()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Erreur lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // TOGGLE STATUS - UNIQUEMENT ACTIVATION/DÉSACTIVATION
  // (PAS DE SUPPRESSION)
  // ============================================================
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('codes_promo')
        .update({ actif: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organisateur_id', user.id)

      if (error) throw error
      setSuccess(`Code ${currentStatus ? 'désactivé' : 'activé'} avec succès`)
      await fetchCodes()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors du changement de statut')
    }
  }

  const toggleTicketType = (ticketId) => {
    setFormData(prev => {
      const current = prev.type_ticket_ids || []
      if (current.includes(ticketId)) {
        return { ...prev, type_ticket_ids: current.filter(id => id !== ticketId) }
      } else {
        return { ...prev, type_ticket_ids: [...current, ticketId] }
      }
    })
  }

  const getStatusBadge = (code) => {
    const now = new Date()
    const dateDebut = new Date(code.date_debut)
    const dateFin = new Date(code.date_fin)

    if (!code.actif) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Inactif</span>
    }
    if (now < dateDebut) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">À venir</span>
    }
    if (now > dateFin) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">Expiré</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Actif</span>
  }

  const getTypeLabel = (type, valeur) => {
    if (type === 'pourcentage') return `${valeur}%`
    return `${valeur.toLocaleString()} FCFA`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getUsageRate = (code) => {
    if (code.quantite_max === 0) return 'Illimité'
    return `${code.utilisations} / ${code.quantite_max}`
  }

  const getEvenementDisplay = (code) => {
    if (code.evenement_id) {
      return code.evenement?.nom || 'Événement'
    }
    return 'Tous les événements'
  }

  const getTypesDisplay = (code) => {
    if (!code.type_ticket_ids || code.type_ticket_ids.length === 0) {
      return 'Tous les types'
    }
    if (code.type_tickets_details && code.type_tickets_details.length > 0) {
      return code.type_tickets_details.map(t => t.nom).join(', ')
    }
    return `${code.type_ticket_ids.length} type(s)`
  }

  const filteredCodes = codes.filter(c => {
    const matchSearch = c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.evenement?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchFilter = filter === 'tous' || 
                        (filter === 'actif' && c.actif === true) ||
                        (filter === 'inactif' && c.actif === false) ||
                        (filter === 'expire' && new Date(c.date_fin) < new Date())
    return matchSearch && matchFilter
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
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
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Codes <span className="text-yellow-400">promotionnels</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {codes.length} / {planInfo.codesMax} codes ({planInfo.planNom})
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                code: generateRandomCode(),
                type: 'pourcentage',
                valeur: '',
                evenement_id: '',
                type_ticket_ids: [],
                date_debut: new Date().toISOString().slice(0, 16),
                date_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                quantite_max: ''
              })
              setTicketTypes([])
              setShowAddModal(true)
            }}
            className="ml-auto flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouveau code
          </button>
        </div>

        {/* Info */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-yellow-400" />
            <p className="text-gray-300 text-sm">
              Les codes promo sont uniques à votre compte. 
              <span className="text-yellow-400 ml-2">
                Limite: {planInfo.codesMax} codes pour le plan {planInfo.planNom}
              </span>
              <br />
              <span className="text-gray-400 text-xs">
                ⚠️ Les codes promo se désactivent automatiquement quand la limite d'utilisations est atteinte.
              </span>
            </p>
          </div>
        </div>

        {/* Recherche et filtres */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un code ou événement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
          >
            <option value="tous">Tous</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
            <option value="expire">Expirés</option>
          </select>
          <button
            onClick={fetchCodes}
            className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Liste des codes - SANS BOUTON SUPPRIMER */}
        {filteredCodes.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <Code className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-30" />
            <p className="text-gray-400 text-lg">Aucun code promo</p>
            <p className="text-gray-500 text-sm">Créez votre premier code promo pour attirer plus de clients</p>
            <button
              onClick={() => {
                setFormData({
                  code: generateRandomCode(),
                  type: 'pourcentage',
                  valeur: '',
                  evenement_id: '',
                  type_ticket_ids: [],
                  date_debut: new Date().toISOString().slice(0, 16),
                  date_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                  quantite_max: ''
                })
                setTicketTypes([])
                setShowAddModal(true)
              }}
              className="mt-4 bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Créer un code promo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCodes.map((code) => (
              <div key={code.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-yellow-400/30 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-yellow-400 font-mono text-lg font-bold">{code.code}</span>
                      {getStatusBadge(code)}
                      {code.quantite_max > 0 && code.utilisations >= code.quantite_max && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                          ⚠️ Limite atteinte
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-gray-300 text-sm flex items-center gap-1">
                        <Percent className="w-3 h-3 text-yellow-400" />
                        {getTypeLabel(code.type, code.valeur)}
                      </p>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(code.date_debut)} → {formatDate(code.date_fin)}
                      </p>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        {getEvenementDisplay(code)}
                      </p>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        {getTypesDisplay(code)}
                      </p>
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Utilisations: {getUsageRate(code)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleStatus(code.id, code.actif)}
                      className={`transition-colors p-1 ${
                        code.actif ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                      }`}
                      title={code.actif ? 'Désactiver' : 'Activer'}
                    >
                      {code.actif ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {/* ❌ BOUTON SUPPRIMER SUPPRIMÉ - L'ORGANISATEUR NE PEUT PAS SUPPRIMER */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL AJOUT CODE PROMO ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Créer un code promo</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCode} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono uppercase"
                    placeholder="PROMO2024"
                    required
                    maxLength="20"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, code: generateRandomCode() })}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                    title="Générer un code"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Type de réduction *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                >
                  <option value="pourcentage">Pourcentage (%)</option>
                  <option value="fixe">Montant fixe (FCFA)</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  {formData.type === 'pourcentage' ? 'Pourcentage (%) *' : 'Montant (FCFA) *'}
                </label>
                <input
                  type="number"
                  value={formData.valeur}
                  onChange={(e) => setFormData({ ...formData, valeur: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder={formData.type === 'pourcentage' ? '10' : '1000'}
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Événement</label>
                <select
                  value={formData.evenement_id}
                  onChange={(e) => {
                    setFormData({ ...formData, evenement_id: e.target.value, type_ticket_ids: [] })
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                >
                  <option value="">Tous les événements</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Laissez vide pour appliquer à tous vos événements</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Types de tickets concernés</label>
                {ticketTypes.length === 0 ? (
                  <p className="text-gray-500 text-xs">
                    {formData.evenement_id 
                      ? 'Aucun type de ticket pour cet événement' 
                      : 'Sélectionnez un événement pour voir les types de tickets'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-800 rounded-lg border border-gray-700">
                    {ticketTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleTicketType(type.id)}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${
                          formData.type_ticket_ids?.includes(type.id)
                            ? 'bg-yellow-400 text-black font-medium'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {type.nom}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  {formData.type_ticket_ids?.length === 0 
                    ? 'Aucun type sélectionné = tous les types' 
                    : `${formData.type_ticket_ids.length} type(s) sélectionné(s)`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Date début *</label>
                  <input
                    type="datetime-local"
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Date fin *</label>
                  <input
                    type="datetime-local"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Nombre maximum d'utilisations</label>
                <input
                  type="number"
                  value={formData.quantite_max}
                  onChange={(e) => setFormData({ ...formData, quantite_max: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="0 = illimité"
                  min="0"
                />
                <p className="text-gray-500 text-xs mt-1">
                  ⚠️ Le code sera automatiquement désactivé quand cette limite sera atteinte.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CodesPromoOrganisateur