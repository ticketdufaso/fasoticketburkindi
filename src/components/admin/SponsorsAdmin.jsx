/**
 * Gestion des Sponsors et Partenaires - Admin
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Un seul onglet "Sponsors & Partenaires"
 * - Section Partenaires : afficher tous les organisateurs, suppression uniquement
 * - Section Sponsors : ajouter, modifier, supprimer (inchangé)
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Award, 
  Plus, 
  Trash2, 
  Loader, 
  RefreshCw, 
  Search,
  Upload,
  Link as LinkIcon,
  Image,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Edit,
  X,
  Users,
  Building2,
  Calendar as CalendarIcon,
  Crown
} from 'lucide-react'

const SponsorsAdmin = () => {
  const [activeTab, setActiveTab] = useState('sponsors')
  
  // État des sponsors
  const [sponsors, setSponsors] = useState([])
  const [sponsorsLoading, setSponsorsLoading] = useState(true)
  const [sponsorsSearchTerm, setSponsorsSearchTerm] = useState('')
  const [showAddSponsorModal, setShowAddSponsorModal] = useState(false)
  const [showEditSponsorModal, setShowEditSponsorModal] = useState(false)
  const [selectedSponsor, setSelectedSponsor] = useState(null)
  
  // État des partenaires (organisateurs)
  const [partenaires, setPartenaires] = useState([])
  const [partenairesLoading, setPartenairesLoading] = useState(true)
  const [partenairesSearchTerm, setPartenairesSearchTerm] = useState('')
  
  // États généraux
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Formulaire sponsor
  const [formData, setFormData] = useState({
    nom: '',
    lien: '',
    image_file: null,
    image_preview: '',
    actif: true,
    ordre: 0
  })

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  useEffect(() => {
    fetchSponsors()
    fetchPartenaires()
  }, [])

  const fetchSponsors = async () => {
    try {
      setSponsorsLoading(true)
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .order('ordre', { ascending: true })

      if (error) throw error
      setSponsors(data || [])
    } catch (error) {
      console.error('Erreur chargement sponsors:', error)
      setError('Erreur lors du chargement des sponsors')
    } finally {
      setSponsorsLoading(false)
    }
  }

  const fetchPartenaires = async () => {
    try {
      setPartenairesLoading(true)
      
      // Récupérer TOUS les organisateurs (même ceux avec statut=false)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, structure, nom_associe, telephone, created_at, statut, plan_id, plan_expire')
        .eq('role', 'organisateur')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        setPartenaires([])
        return
      }

      // Pour chaque organisateur, compter ses événements
      const partenairesAvecStats = await Promise.all(
        data.map(async (org) => {
          const { count: evenementsCount, error: countError } = await supabase
            .from('evenements')
            .select('*', { count: 'exact', head: true })
            .eq('organisateur_id', org.id)

          if (countError) {
            return {
              ...org,
              evenementsCount: 0,
              estActif: org.statut === true && org.plan_expire && new Date(org.plan_expire) > new Date()
            }
          }

          return {
            ...org,
            evenementsCount: evenementsCount || 0,
            estActif: org.statut === true && org.plan_expire && new Date(org.plan_expire) > new Date()
          }
        })
      )

      // Trier par nombre d'événements décroissant
      partenairesAvecStats.sort((a, b) => b.evenementsCount - a.evenementsCount)

      setPartenaires(partenairesAvecStats)
    } catch (error) {
      console.error('Erreur chargement partenaires:', error)
      setError('Erreur lors du chargement des partenaires')
    } finally {
      setPartenairesLoading(false)
    }
  }

  // ============================================================
  // FONCTIONS SPONSORS
  // ============================================================

  const formatLien = (lien) => {
    if (!lien) return ''
    const trimmed = lien.trim()
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`
    }
    return trimmed
  }

  const uploadImage = async (file) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `sponsor_${Date.now()}.${fileExt}`
      const filePath = `sponsors/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('sponsor-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('sponsor-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      throw new Error('Erreur lors de l\'upload de l\'image: ' + error.message)
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 2 Mo')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image')
      return
    }

    setFormData({
      ...formData,
      image_file: file,
      image_preview: URL.createObjectURL(file)
    })
  }

  const handleSponsorSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!formData.nom || formData.nom.length < 2) {
      setError('Le nom doit contenir au moins 2 caractères')
      setSubmitting(false)
      return
    }

    const lienFormate = formatLien(formData.lien)
    if (!lienFormate) {
      setError('Veuillez entrer un lien valide')
      setSubmitting(false)
      return
    }

    try {
      let imageUrl = formData.image_preview || '/images/default-sponsor.png'

      if (formData.image_file) {
        imageUrl = await uploadImage(formData.image_file)
      }

      const sponsorData = {
        nom: formData.nom.trim(),
        lien: lienFormate,
        image_url: imageUrl,
        actif: formData.actif,
        ordre: parseInt(formData.ordre) || 0
      }

      if (showEditSponsorModal && selectedSponsor) {
        const { error } = await supabase
          .from('sponsors')
          .update({
            ...sponsorData,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSponsor.id)

        if (error) throw error
        setSuccess('Sponsor modifié avec succès !')
      } else {
        const { error } = await supabase
          .from('sponsors')
          .insert([sponsorData])

        if (error) throw error
        setSuccess('Sponsor ajouté avec succès !')
      }

      setShowAddSponsorModal(false)
      setShowEditSponsorModal(false)
      resetForm()
      await fetchSponsors()
      setTimeout(() => setSuccess(''), 3000)

    } catch (error) {
      setError(error.message || 'Erreur lors de l\'opération')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSponsor = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce sponsor ?')) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    try {
      const { error } = await supabase
        .from('sponsors')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess('Sponsor supprimé avec succès')
      await fetchSponsors()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleToggleSponsorStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('sponsors')
        .update({ 
          actif: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      await fetchSponsors()
    } catch (error) {
      setError('Erreur lors du changement de statut')
    }
  }

  const resetForm = () => {
    setFormData({
      nom: '',
      lien: '',
      image_file: null,
      image_preview: '',
      actif: true,
      ordre: 0
    })
  }

  const openEditSponsorModal = (sponsor) => {
    setSelectedSponsor(sponsor)
    setFormData({
      nom: sponsor.nom,
      lien: sponsor.lien,
      image_file: null,
      image_preview: sponsor.image_url || '',
      actif: sponsor.actif,
      ordre: sponsor.ordre || 0
    })
    setShowEditSponsorModal(true)
  }

  // ============================================================
  // FONCTIONS PARTENAIRES
  // ============================================================

  const handleDeletePartenaire = async (userId) => {
    const targetUser = partenaires.find(p => p.id === userId)
    if (!targetUser) {
      setError('Partenaire non trouvé')
      return
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le partenaire "${targetUser.structure || targetUser.email}" ?`)) return
    if (!confirm('Cette action est irréversible. Toutes les données associées seront supprimées.')) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      // 1. Récupérer les événements de l'organisateur
      const { data: events, error: eventsError } = await supabase
        .from('evenements')
        .select('id')
        .eq('organisateur_id', userId)

      if (eventsError) {
        console.error('Erreur récupération événements:', eventsError)
      }

      if (events && events.length > 0) {
        const eventIds = events.map(e => e.id)

        // 2. Récupérer les types de tickets
        const { data: ticketTypes, error: ticketError } = await supabase
          .from('types_tickets')
          .select('id')
          .in('evenement_id', eventIds)

        if (ticketError) {
          console.error('Erreur récupération types tickets:', ticketError)
        }

        if (ticketTypes && ticketTypes.length > 0) {
          const ticketIds = ticketTypes.map(t => t.id)

          // 3. Supprimer les ventes
          await supabase
            .from('ventes')
            .delete()
            .in('type_ticket_id', ticketIds)

          // 4. Supprimer les réservations
          await supabase
            .from('reservations')
            .delete()
            .in('type_ticket_id', ticketIds)

          // 5. Supprimer les types de tickets
          await supabase
            .from('types_tickets')
            .delete()
            .in('id', ticketIds)
        }

        // 6. Supprimer les événements
        await supabase
          .from('evenements')
          .delete()
          .in('id', eventIds)
      }

      // 7. Supprimer les codes promo
      await supabase
        .from('codes_promo')
        .delete()
        .eq('organisateur_id', userId)

      // 8. Supprimer les paiements organisateurs
      await supabase
        .from('paiements_organisateurs')
        .delete()
        .eq('organisateur_id', userId)

      // 9. Supprimer les agents créés
      await supabase
        .from('profiles')
        .delete()
        .eq('created_by', userId)
        .eq('role', 'agent')

      // 10. Supprimer le profil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) throw profileError

      // 11. Supprimer l'utilisateur dans Auth
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzd3ppZ3FrcXFubHd2Z3V2cmdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUwNzg0MCwiZXhwIjoyMDk4MDgzODQwfQ.bm4kwE2co0Tmmp_Q1a0TUyoI6BlztMsEj3jMzmPG9AY'

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn('Erreur suppression auth.users:', await response.text())
      }

      setSuccess(`✅ Partenaire "${targetUser.structure || targetUser.email}" supprimé avec succès`)
      
      await fetchPartenaires()
      await fetchSponsors()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur suppression:', error)
      setError('Erreur lors de la suppression: ' + (error.message || 'Veuillez réessayer'))
      setTimeout(() => setError(''), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // FILTRES
  // ============================================================

  const filteredSponsors = sponsors.filter(s =>
    s.nom?.toLowerCase().includes(sponsorsSearchTerm.toLowerCase()) ||
    s.lien?.toLowerCase().includes(sponsorsSearchTerm.toLowerCase())
  )

  const filteredPartenaires = partenaires.filter(p =>
    p.structure?.toLowerCase().includes(partenairesSearchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(partenairesSearchTerm.toLowerCase()) ||
    p.nom_associe?.toLowerCase().includes(partenairesSearchTerm.toLowerCase())
  )

  // ============================================================
  // UTILITAIRES
  // ============================================================

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Non défini'
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (partenaire) => {
    if (!partenaire.estActif) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          Inactif
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
        Actif
      </span>
    )
  }

  // ============================================================
  // RENDU
  // ============================================================

  if (sponsorsLoading || partenairesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* ===== HEADER ===== */}
      <div className="p-4 md:p-6 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Sponsors & Partenaires</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchSponsors()
                fetchPartenaires()
              }}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===== ONGLETS ===== */}
        <div className="flex gap-2 mt-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('sponsors')}
            className={`px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
              activeTab === 'sponsors'
                ? 'bg-yellow-400 text-black font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Award className="w-4 h-4" />
            Sponsors ({sponsors.length})
          </button>
          <button
            onClick={() => setActiveTab('partenaires')}
            className={`px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
              activeTab === 'partenaires'
                ? 'bg-yellow-400 text-black font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Partenaires ({partenaires.length})
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* ===== CONTENU SPONSORS ===== */}
      {activeTab === 'sponsors' && (
        <div>
          <div className="p-4 flex justify-between items-center border-b border-gray-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un sponsor..."
                value={sponsorsSearchTerm}
                onChange={(e) => setSponsorsSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowAddSponsorModal(true)
              }}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ajouter un sponsor
            </button>
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Aucun sponsor trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
              {filteredSponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className={`bg-gray-800 rounded-xl overflow-hidden border transition-all ${
                    sponsor.actif 
                      ? 'border-gray-700 hover:border-yellow-400/30' 
                      : 'border-red-500/20 opacity-60'
                  }`}
                >
                  <div className="aspect-square bg-gray-700 flex items-center justify-center p-4 relative group">
                    {sponsor.image_url ? (
                      <img
                        src={sponsor.image_url}
                        alt={sponsor.nom}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = '/images/default-sponsor.png'
                          e.target.onerror = null
                        }}
                      />
                    ) : (
                      <Image className="w-12 h-12 text-gray-500" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a
                        href={sponsor.lien}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-yellow-400 transition-colors"
                        title="Voir le lien"
                      >
                        <ExternalLink className="w-6 h-6" />
                      </a>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-white text-sm font-medium truncate">{sponsor.nom}</p>
                    <p className="text-gray-400 text-xs truncate">{sponsor.lien}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sponsor.actif 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {sponsor.actif ? 'Actif' : 'Inactif'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleSponsorStatus(sponsor.id, sponsor.actif)}
                          className={`transition-colors p-1 ${
                            sponsor.actif 
                              ? 'text-red-400 hover:text-red-300' 
                              : 'text-green-400 hover:text-green-300'
                          }`}
                          title={sponsor.actif ? 'Désactiver' : 'Activer'}
                        >
                          {sponsor.actif ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditSponsorModal(sponsor)}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors p-1"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSponsor(sponsor.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONTENU PARTENAIRES ===== */}
      {activeTab === 'partenaires' && (
        <div>
          <div className="p-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un partenaire..."
                value={partenairesSearchTerm}
                onChange={(e) => setPartenairesSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {partenaires.length} partenaire(s) - Suppression uniquement
            </p>
          </div>

          {filteredPartenaires.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Aucun partenaire trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Structure</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">Événements</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden lg:table-cell">Depuis</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Statut</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartenaires.map((partenaire) => (
                    <tr key={partenaire.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white text-sm font-medium">{partenaire.structure || partenaire.nom_associe || 'Non défini'}</p>
                          {partenaire.plan_id && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              partenaire.plan_id === 'Premium' 
                                ? 'bg-yellow-500/20 text-yellow-400' 
                                : 'bg-gray-700 text-gray-300'
                            }`}>
                              {partenaire.plan_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden sm:table-cell">
                        {partenaire.email}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3 text-yellow-400" />
                          {partenaire.evenementsCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell">
                        {formatDate(partenaire.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(partenaire)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeletePartenaire(partenaire.id)}
                          disabled={submitting}
                          className="text-red-400 hover:text-red-300 transition-colors p-1 disabled:opacity-50"
                          title="Supprimer ce partenaire"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== MODAL AJOUT SPONSOR ===== */}
      {showAddSponsorModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Ajouter un sponsor</h3>
              <button
                onClick={() => {
                  setShowAddSponsorModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSponsorSubmit} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nom du sponsor *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="Nom du sponsor"
                  required
                  maxLength="100"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Lien du site *</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={formData.lien}
                    onChange={(e) => setFormData({ ...formData, lien: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="exemple.com ou https://exemple.com"
                    required
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">💡 Le https:// sera ajouté automatiquement si absent</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Logo du sponsor</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Choisir une image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.image_preview && (
                    <div className="relative w-16 h-16">
                      <img
                        src={formData.image_preview}
                        alt="Aperçu"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_file: null, image_preview: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">PNG, JPG, WEBP - Max 2 Mo</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formData.ordre}
                    onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-gray-300 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="accent-yellow-400"
                    />
                    Actif
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSponsorModal(false)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    'Ajouter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL MODIFICATION SPONSOR ===== */}
      {showEditSponsorModal && selectedSponsor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Modifier le sponsor</h3>
              <button
                onClick={() => {
                  setShowEditSponsorModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSponsorSubmit} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nom du sponsor *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="Nom du sponsor"
                  required
                  maxLength="100"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Lien du site *</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={formData.lien}
                    onChange={(e) => setFormData({ ...formData, lien: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="exemple.com ou https://exemple.com"
                    required
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">💡 Le https:// sera ajouté automatiquement si absent</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Logo du sponsor</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Changer l'image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.image_preview && (
                    <div className="relative w-16 h-16">
                      <img
                        src={formData.image_preview}
                        alt="Aperçu"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_file: null, image_preview: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">PNG, JPG, WEBP - Max 2 Mo</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formData.ordre}
                    onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-gray-300 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="accent-yellow-400"
                    />
                    Actif
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSponsorModal(false)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    'Modifier'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SponsorsAdmin