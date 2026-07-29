/**
 * Gestion des Paiements - Admin
 * Règles NASA 1-10
 * Affiche tous les paiements (gateway, admin, organisateurs)
 * ✅ CORRECTION : Fusion des tables paiements_organisateurs et paiements_plans
 * ✅ CORRECTION : Ajout des revenus lors de la validation d'un paiement
 * ✅ CORRECTION : Suppression de TOUTES les tables pour "Supprimer tout"
 * ✅ CORRECTION : Boutons en haut du tableau
 * ✅ CORRECTION : Affichage uniquement Validés et En attente (pas Rejetés)
 * ✅ CORRECTION : Mise à jour des compteurs lors des changements de statut
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  DollarSign, Trash2, CheckCircle, XCircle, AlertCircle,
  Search, Plus, Loader, RefreshCw, Eye, Edit,
  Square, CheckSquare
} from 'lucide-react'

const PaiementsAdmin = () => {
  const [paiements, setPaiements] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('tous')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [stats, setStats] = useState({ 
    total: 0, 
    enAttente: 0, 
    valides: 0
  })
  const [selectedPaiement, setSelectedPaiement] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  
  // États pour la sélection multiple
  const [selectedIds, setSelectedIds] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  
  const [newPaiement, setNewPaiement] = useState({
    transaction_id: '',
    montant: '',
    numero_depot: '',
    plan_id: '',
    organisateur_id: '',
    source: 'admin_manuel'
  })

  const [organisateurs, setOrganisateurs] = useState([])

  useEffect(() => {
    fetchOrganisateurs()
    fetchPaiements()
    
    const subscription = supabase
      .channel('paiements_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'paiements_organisateurs' },
        () => {
          fetchPaiements()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'paiements_plans' },
        () => {
          fetchPaiements()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // ============================================================
  // RÉCUPÉRATION DES ORGANISATEURS
  // ============================================================
  const fetchOrganisateurs = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, structure, email, nom_associe')
        .eq('role', 'organisateur')
        .order('structure', { ascending: true })

      if (error) throw error
      setOrganisateurs(data || [])
    } catch (error) {
      console.error('Erreur récupération organisateurs:', error)
    }
  }

  // ============================================================
  // RÉCUPÉRATION DES PAIEMENTS (FUSION DES 2 TABLES)
  // ============================================================
  const fetchPaiements = async () => {
    try {
      setLoading(true)
      
      // 1. Récupérer les paiements de paiements_organisateurs
      const { data: paiementsOrg, error: errorOrg } = await supabase
        .from('paiements_organisateurs')
        .select(`
          *,
          organisateur:profiles(id, structure, email, nom_associe)
        `)
        .order('created_at', { ascending: false })

      if (errorOrg) {
        console.error('Erreur paiements_organisateurs:', errorOrg)
      }

      // 2. Récupérer les paiements de paiements_plans
      const { data: paiementsPlans, error: errorPlans } = await supabase
        .from('paiements_plans')
        .select(`
          *,
          organisateur:profiles(id, structure, email, nom_associe)
        `)
        .order('created_at', { ascending: false })

      if (errorPlans) {
        console.error('Erreur paiements_plans:', errorPlans)
      }

      // 3. Fusionner les 2 tableaux avec un type pour les identifier
      const paiementsOrgFormatted = (paiementsOrg || []).map(p => ({
        ...p,
        source_table: 'paiements_organisateurs',
        plan_id: p.plan_id || 'Basique',
        source_type: 'gateway_admin'
      }))

      const paiementsPlansFormatted = (paiementsPlans || []).map(p => ({
        ...p,
        source_table: 'paiements_plans',
        source_type: 'plan_achat',
        numero_depot: p.numero_depot || 'ACHAT_PLAN'
      }))

      // 4. Fusionner et trier par date décroissante
      const allPaiements = [...paiementsOrgFormatted, ...paiementsPlansFormatted]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setPaiements(allPaiements)

      // 5. Statistiques - UNIQUEMENT Validés et En attente
      const total = allPaiements.length
      const enAttente = allPaiements.filter(p => p.statut === 'en_attente').length
      const valides = allPaiements.filter(p => p.statut === 'valide').length

      setStats({ total, enAttente, valides })
      
      setSelectedIds([])
      setSelectAll(false)
      
    } catch (error) {
      console.error('Erreur fetchPaiements:', error)
      setError('Erreur lors du chargement des paiements')
      setPaiements([])
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // AJOUTER UN PAIEMENT AUX REVENUS (table paiements_plans)
  // ============================================================
  const ajouterRevenus = async (paiementId, sourceTable) => {
    try {
      // Récupérer le paiement depuis la bonne table
      let paiement = null
      
      if (sourceTable === 'paiements_organisateurs') {
        const { data, error } = await supabase
          .from('paiements_organisateurs')
          .select('*')
          .eq('id', paiementId)
          .single()

        if (error || !data) {
          console.error('Paiement non trouvé:', error)
          return false
        }
        paiement = data
      } else {
        // Déjà dans paiements_plans, ne pas ajouter en double
        return true
      }

      if (!paiement || !paiement.organisateur_id) {
        return false
      }

      // Vérifier si un paiement existe déjà dans paiements_plans
      const { data: existing, error: checkError } = await supabase
        .from('paiements_plans')
        .select('id')
        .eq('organisateur_id', paiement.organisateur_id)
        .eq('montant', paiement.montant)
        .eq('statut', 'valide')
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erreur vérification:', checkError)
        return false
      }

      if (existing) {
        return true
      }

      const transactionId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const numeroDepot = `PAY_${Math.random().toString(36).substring(2, 10).toUpperCase()}`

      const { error: insertError } = await supabase
        .from('paiements_plans')
        .insert([{
          organisateur_id: paiement.organisateur_id,
          plan_id: paiement.plan_id || 'Basique',
          montant: paiement.montant,
          transaction_id: transactionId,
          numero_depot: numeroDepot,
          statut: 'valide',
          source: paiement.source || 'gateway',
          created_at: paiement.created_at || new Date().toISOString()
        }])

      if (insertError) {
        console.error('Erreur insertion paiements_plans:', insertError)
        return false
      }

      return true
    } catch (error) {
      console.error('Erreur ajout revenus:', error)
      return false
    }
  }

  // ============================================================
  // RETIRER UN PAIEMENT DES REVENUS
  // ============================================================
  const retirerRevenus = async (paiementId) => {
    try {
      const { error } = await supabase
        .from('paiements_plans')
        .delete()
        .eq('id', paiementId)

      if (error) {
        console.error('Erreur retrait revenus:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Erreur retrait revenus:', error)
      return false
    }
  }

  // ============================================================
  // GESTION DE LA SÉLECTION
  // ============================================================
  
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = filteredPaiements.map(p => p.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  // ============================================================
  // ✅ SUPPRESSION EN MASSE (Supprime des 2 tables en même temps)
  // ============================================================
  
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      setError('❌ Aucun paiement sélectionné')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer ${selectedIds.length} paiement(s) sélectionné(s) ?`)) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    setDeletingSelected(true)
    setError('')
    setSuccess('')

    try {
      // Séparer les IDs par table source
      const selectedPaiements = paiements.filter(p => selectedIds.includes(p.id))
      const idsOrg = selectedPaiements.filter(p => p.source_table === 'paiements_organisateurs').map(p => p.id)
      const idsPlans = selectedPaiements.filter(p => p.source_table === 'paiements_plans').map(p => p.id)

      // Supprimer de paiements_organisateurs
      if (idsOrg.length > 0) {
        const { error } = await supabase
          .from('paiements_organisateurs')
          .delete()
          .in('id', idsOrg)
        if (error) throw error
      }

      // Supprimer de paiements_plans
      if (idsPlans.length > 0) {
        const { error } = await supabase
          .from('paiements_plans')
          .delete()
          .in('id', idsPlans)
        if (error) throw error
      }

      setSuccess(`✅ ${selectedIds.length} paiement(s) supprimé(s) avec succès`)
      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteSelectedModal(false)
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur suppression en masse:', error)
      setError('❌ Erreur lors de la suppression en masse')
      setTimeout(() => setError(''), 3000)
    } finally {
      setDeletingSelected(false)
    }
  }

  // ============================================================
  // ✅ SUPPRESSION TOUT (Supprime TOUTES les lignes des 2 tables)
  // ✅ CORRECTION : Utilisation de .filter() avec une condition toujours vraie
  // ============================================================
  const handleDeleteAll = async () => {
    if (paiements.length === 0) {
      setError('❌ Aucun paiement à supprimer')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer TOUS les ${paiements.length} paiements ?`)) return
    if (!confirm('⚠️⚠️ Cette action est irréversible et supprimera TOUS les paiements ! Confirmer ?')) return

    setDeletingAll(true)
    setError('')
    setSuccess('')

    try {
      // ✅ Supprimer TOUS les paiements des 2 tables
      // On utilise une condition toujours vraie : neq('id', '00000000-0000-0000-0000-000000000000')
      // car Supabase exige une clause WHERE
      
      const fakeUuid = '00000000-0000-0000-0000-000000000000'

      // 1. Supprimer tous les paiements de paiements_organisateurs
      const { error: errorOrg } = await supabase
        .from('paiements_organisateurs')
        .delete()
        .neq('id', fakeUuid)

      if (errorOrg) throw errorOrg

      // 2. Supprimer tous les paiements de paiements_plans
      const { error: errorPlans } = await supabase
        .from('paiements_plans')
        .delete()
        .neq('id', fakeUuid)

      if (errorPlans) throw errorPlans

      setSuccess(`✅ ${paiements.length} paiement(s) supprimé(s) avec succès`)
      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteAllModal(false)
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur suppression totale:', error)
      
      // Affichage plus détaillé de l'erreur
      let errorMessage = '❌ Erreur lors de la suppression totale'
      if (error.message) {
        errorMessage += `: ${error.message}`
      }
      if (error.details) {
        errorMessage += ` (${error.details})`
      }
      setError(errorMessage)
      setTimeout(() => setError(''), 5000)
    } finally {
      setDeletingAll(false)
    }
  }

  // ============================================================
  // SUPPRESSION D'UN PAIEMENT (SIMPLE)
  // ============================================================
  const handleDelete = async (id, sourceTable) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    try {
      if (sourceTable === 'paiements_organisateurs') {
        const { error } = await supabase
          .from('paiements_organisateurs')
          .delete()
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('paiements_plans')
          .delete()
          .eq('id', id)
        if (error) throw error
      }
      
      setSuccess('✅ Paiement supprimé avec succès')
      setSelectedIds(prev => prev.filter(pid => pid !== id))
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur suppression:', error)
      setError('❌ Erreur lors de la suppression')
      setTimeout(() => setError(''), 3000)
    }
  }

  // ============================================================
  // CHANGEMENT DE STATUT AVEC AJOUT/RETRAIT AUX REVENUS
  // ============================================================
  const handleStatusChange = async (id, statut, sourceTable) => {
    try {
      // Récupérer l'ancien statut
      const paiement = paiements.find(p => p.id === id)
      const ancienStatut = paiement?.statut

      if (sourceTable === 'paiements_organisateurs') {
        const { error } = await supabase
          .from('paiements_organisateurs')
          .update({ 
            statut, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id)

        if (error) throw error

        // ✅ Gestion des revenus selon le changement de statut
        if (statut === 'valide' && ancienStatut !== 'valide') {
          // Ajouter aux revenus
          const result = await ajouterRevenus(id, sourceTable)
          if (result) {
            setSuccess('✅ Paiement validé et ajouté aux revenus !')
          } else {
            setSuccess('✅ Paiement validé (revenus déjà existants)')
          }
        } else if (statut !== 'valide' && ancienStatut === 'valide') {
          // Retirer des revenus
          const { data: paiementPlan } = await supabase
            .from('paiements_plans')
            .select('id')
            .eq('organisateur_id', paiement?.organisateur_id)
            .eq('montant', paiement?.montant)
            .eq('statut', 'valide')
            .maybeSingle()

          if (paiementPlan) {
            await retirerRevenus(paiementPlan.id)
          }
          setSuccess(`✅ Statut changé en ${statut === 'rejete' ? 'Rejeté' : 'En attente'} - Revenus retirés`)
        } else {
          setSuccess(`✅ Statut changé en ${statut === 'valide' ? 'Validé' : statut === 'rejete' ? 'Rejeté' : 'En attente'}`)
        }
      } else {
        // Dans paiements_plans, on met à jour directement
        const { error } = await supabase
          .from('paiements_plans')
          .update({ 
            statut, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id)

        if (error) throw error
        
        setSuccess(`✅ Statut changé en ${statut === 'valide' ? 'Validé' : 'En attente'}`)
      }
      
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur changement statut:', error)
      setError('❌ Erreur lors du changement de statut')
      setTimeout(() => setError(''), 3000)
    }
  }

  // ============================================================
  // AJOUT MANUEL D'UN PAIEMENT (dans paiements_organisateurs)
  // ============================================================
  const handleAddPaiement = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!newPaiement.transaction_id || newPaiement.transaction_id.length < 5) {
      setError('❌ ID Transaction invalide (minimum 5 caractères)')
      setSubmitting(false)
      return
    }
    if (!newPaiement.montant || parseInt(newPaiement.montant) <= 0) {
      setError('❌ Montant invalide (doit être supérieur à 0)')
      setSubmitting(false)
      return
    }
    if (!newPaiement.numero_depot || !/^[0-9]{8}$/.test(newPaiement.numero_depot)) {
      setError('❌ Numéro de dépôt invalide (ex: 70123456)')
      setSubmitting(false)
      return
    }

    try {
      const { data: existing, error: checkError } = await supabase
        .from('paiements_organisateurs')
        .select('id, transaction_id')
        .eq('transaction_id', newPaiement.transaction_id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existing) {
        setError('❌ Cette transaction existe déjà')
        setSubmitting(false)
        return
      }

      const dataToInsert = {
        transaction_id: newPaiement.transaction_id.trim(),
        montant: parseInt(newPaiement.montant),
        numero_depot: newPaiement.numero_depot.trim(),
        statut: 'en_attente',
        source: newPaiement.source || 'admin_manuel'
      }

      if (newPaiement.organisateur_id) {
        dataToInsert.organisateur_id = newPaiement.organisateur_id
      }

      if (newPaiement.plan_id) {
        dataToInsert.plan_id = newPaiement.plan_id
      }

      const { error: insertError } = await supabase
        .from('paiements_organisateurs')
        .insert([dataToInsert])

      if (insertError) {
        console.error('Erreur insertion:', insertError)
        setError('❌ Erreur lors de l\'insertion: ' + (insertError.message || 'Veuillez réessayer'))
        setSubmitting(false)
        return
      }

      setSuccess('✅ Paiement ajouté avec succès')
      setShowAddModal(false)
      setNewPaiement({
        transaction_id: '',
        montant: '',
        numero_depot: '',
        plan_id: '',
        organisateur_id: '',
        source: 'admin_manuel'
      })
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setError('❌ Erreur lors de l\'ajout: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // MODIFICATION D'UN PAIEMENT
  // ============================================================
  const handleEditPaiement = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!selectedPaiement) return

    try {
      const ancienStatut = selectedPaiement.statut
      const nouveauStatut = selectedPaiement.statut

      const updateData = {
        statut: selectedPaiement.statut,
        updated_at: new Date().toISOString()
      }

      if (selectedPaiement.organisateur_id) {
        updateData.organisateur_id = selectedPaiement.organisateur_id
      }

      let error = null

      if (selectedPaiement.source_table === 'paiements_organisateurs') {
        const result = await supabase
          .from('paiements_organisateurs')
          .update(updateData)
          .eq('id', selectedPaiement.id)
        error = result.error
      } else {
        const result = await supabase
          .from('paiements_plans')
          .update(updateData)
          .eq('id', selectedPaiement.id)
        error = result.error
      }

      if (error) throw error

      // ✅ Gestion des revenus si le statut change
      if (ancienStatut !== nouveauStatut) {
        if (nouveauStatut === 'valide' && ancienStatut !== 'valide') {
          await ajouterRevenus(selectedPaiement.id, selectedPaiement.source_table)
        } else if (nouveauStatut !== 'valide' && ancienStatut === 'valide') {
          const { data: paiementPlan } = await supabase
            .from('paiements_plans')
            .select('id')
            .eq('organisateur_id', selectedPaiement.organisateur_id)
            .eq('montant', selectedPaiement.montant)
            .eq('statut', 'valide')
            .maybeSingle()

          if (paiementPlan) {
            await retirerRevenus(paiementPlan.id)
          }
        }
      }

      setSuccess('✅ Paiement modifié avec succès')
      setShowEditModal(false)
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur modification:', error)
      setError('❌ Erreur lors de la modification')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // FORMATAGE
  // ============================================================

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

  const formatCurrency = (amount) => {
    if (!amount) return '0'
    return amount.toLocaleString()
  }

  const getStatusBadge = (statut) => {
    const config = {
      'valide': { color: 'bg-green-500/20 text-green-400', label: '✅ Validé', icon: <CheckCircle className="w-3 h-3" /> },
      'en_attente': { color: 'bg-yellow-500/20 text-yellow-400', label: '⏳ En attente', icon: <AlertCircle className="w-3 h-3" /> }
    }
    const c = config[statut] || config['en_attente']
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
        {c.icon}
        {c.label}
      </span>
    )
  }

  const getSourceLabel = (paiement) => {
    if (paiement.source_table === 'paiements_plans') {
      const sources = {
        'admin_add': '👤 Admin - Création organisateur',
        'admin_change': '👤 Admin - Changement plan',
        'admin_reactivate': '👤 Admin - Réactivation',
        'organisateur_achat': '🛒 Organisateur - Achat plan',
        'gateway': '📱 Gateway SMS'
      }
      return sources[paiement.source] || sources[paiement.source_type] || '📱 Paiement plan'
    }
    return getSourceLabelOrg(paiement.source)
  }

  const getSourceLabelOrg = (source) => {
    const sources = {
      'gateway': '📱 Gateway SMS',
      'admin_manuel': '👤 Admin manuel',
      'admin_add': '👤 Admin ajout',
      'admin_change': '👤 Admin changement',
      'admin_reactivate': '👤 Admin réactivation',
      'organisateur_achat': '🛒 Organisateur achat'
    }
    return sources[source] || source || '📱 Gateway SMS'
  }

  // ============================================================
  // FILTRES
  // ============================================================

  const filteredPaiements = paiements.filter(p => {
    const matchSearch = p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.numero_depot?.includes(searchTerm) ||
                        p.organisateur?.structure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.organisateur?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchFilter = filter === 'tous' || p.statut === filter
    return matchSearch && matchFilter
  })

  // ============================================================
  // RENDU
  // ============================================================

  if (loading) {
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
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Gestion des paiements</h2>
            <span className="text-gray-400 text-sm">({paiements.length} paiements)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ajouter manuellement
            </button>
          </div>
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

      {/* ===== STATISTIQUES ===== */}
      <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-800">
        <div className="bg-gray-800 rounded-lg p-3 text-center border border-green-500/20">
          <div className="text-green-400 text-2xl font-bold">{stats.valides}</div>
          <div className="text-gray-400 text-xs">✅ Validés</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center border border-yellow-500/20">
          <div className="text-yellow-400 text-2xl font-bold">{stats.enAttente}</div>
          <div className="text-gray-400 text-xs">⏳ En attente</div>
        </div>
      </div>

      {/* ===== FILTRES ET RECHERCHE ===== */}
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher par ID, numéro, nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
        >
          <option value="tous">Tous</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Validés</option>
        </select>
        <button
          onClick={fetchPaiements}
          className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ===== BARRE D'OUTILS EN HAUT (SÉLECTION) ===== */}
      {paiements.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                selectAll 
                  ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectAll ? 'Désélectionner tout' : 'Tout sélectionner'}
            </button>
            {selectedIds.length > 0 && (
              <span className="text-gray-400 text-sm">
                {selectedIds.length} sélectionné(s)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setShowDeleteSelectedModal(true)}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer la sélection ({selectedIds.length})
              </button>
            )}
            {paiements.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center gap-1 bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer tout
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== TABLEAU DES PAIEMENTS ===== */}
      {filteredPaiements.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Aucun paiement trouvé</p>
          <p className="text-sm text-gray-500 mt-1">Les paiements détectés par le Gateway apparaîtront ici</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-2 py-3 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                    title={selectAll ? 'Désélectionner tout' : 'Sélectionner tout'}
                  >
                    {selectAll ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">ID Transaction</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Montant</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">N° Dépôt</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden lg:table-cell">Organisateur</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden xl:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Statut</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaiements.map((p) => {
                const sourceLabel = getSourceLabel(p)
                const organisateurNom = p.organisateur?.structure || p.organisateur?.nom_associe || p.organisateur?.email || 'Non attribué'
                const isSelected = selectedIds.includes(p.id)
                const isFromPlans = p.source_table === 'paiements_plans'
                
                return (
                  <tr key={`${p.source_table}-${p.id}`} className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-yellow-400/5' : ''}`}>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className="text-gray-400 hover:text-yellow-400 transition-colors"
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5 text-yellow-400" /> : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm font-mono max-w-[120px] truncate">
                      {p.transaction_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-yellow-400 text-sm font-medium whitespace-nowrap">
                      {formatCurrency(p.montant)} FCFA
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                      {p.numero_depot || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell max-w-[100px] truncate">
                      {p.organisateur_id ? organisateurNom : (
                        <span className="text-gray-500 text-xs">Non attribué</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">
                      {sourceLabel}
                      {isFromPlans && (
                        <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-400 px-1 rounded">Plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(p.statut)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedPaiement({...p}); setShowDetailsModal(true) }}
                          className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedPaiement({...p}); setShowEditModal(true) }}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors p-1"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {p.statut === 'en_attente' && (
                          <button
                            onClick={() => handleStatusChange(p.id, 'valide', p.source_table)}
                            className="text-green-400 hover:text-green-300 transition-colors p-1"
                            title="Valider (ajouter aux revenus)"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {p.statut === 'valide' && (
                          <button
                            onClick={() => handleStatusChange(p.id, 'en_attente', p.source_table)}
                            className="text-yellow-400 hover:text-yellow-300 transition-colors p-1"
                            title="Mettre en attente (retirer des revenus)"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p.id, p.source_table)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== MODAL AJOUT PAIEMENT ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Ajouter un paiement manuellement</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPaiement} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">ID Transaction *</label>
                <input
                  type="text"
                  value={newPaiement.transaction_id}
                  onChange={(e) => setNewPaiement({ ...newPaiement, transaction_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono"
                  placeholder="PP260424.1234.56789012"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Montant (FCFA) *</label>
                <input
                  type="number"
                  value={newPaiement.montant}
                  onChange={(e) => setNewPaiement({ ...newPaiement, montant: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="100000"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Numéro de dépôt *</label>
                <input
                  type="tel"
                  value={newPaiement.numero_depot}
                  onChange={(e) => setNewPaiement({ ...newPaiement, numero_depot: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="70123456"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Organisateur (optionnel)</label>
                <select
                  value={newPaiement.organisateur_id}
                  onChange={(e) => setNewPaiement({ ...newPaiement, organisateur_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                >
                  <option value="">Non attribué</option>
                  {organisateurs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.structure || org.nom_associe || org.email}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    <>
                      <Plus className="w-4 h-4" />
                      Ajouter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAILS PAIEMENT ===== */}
      {showDetailsModal && selectedPaiement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Détails du paiement</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-xs">Source</p>
                <p className="text-white">{getSourceLabel(selectedPaiement)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">ID Transaction</p>
                <p className="text-white font-mono break-all">{selectedPaiement.transaction_id || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Montant</p>
                <p className="text-yellow-400 font-bold">{formatCurrency(selectedPaiement.montant)} FCFA</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Numéro de dépôt</p>
                <p className="text-white">{selectedPaiement.numero_depot || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Organisateur</p>
                <p className="text-white">
                  {selectedPaiement.organisateur?.structure || 
                   selectedPaiement.organisateur?.nom_associe || 
                   selectedPaiement.organisateur?.email || 
                   <span className="text-gray-500">Non attribué</span>}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Plan</p>
                <p className="text-white">{selectedPaiement.plan_id || 'Basique'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Statut</p>
                <p>{getStatusBadge(selectedPaiement.statut)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Date de création</p>
                <p className="text-white">{formatDate(selectedPaiement.created_at)}</p>
              </div>
              {selectedPaiement.updated_at && selectedPaiement.updated_at !== selectedPaiement.created_at && (
                <div>
                  <p className="text-gray-400 text-xs">Dernière mise à jour</p>
                  <p className="text-white">{formatDate(selectedPaiement.updated_at)}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
              >
                Fermer
              </button>
              {selectedPaiement.statut === 'en_attente' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedPaiement.id, 'valide', selectedPaiement.source_table)
                    setShowDetailsModal(false)
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors font-medium"
                >
                  Valider
                </button>
              )}
              {selectedPaiement.statut === 'valide' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedPaiement.id, 'en_attente', selectedPaiement.source_table)
                    setShowDetailsModal(false)
                  }}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg transition-colors font-medium"
                >
                  Mettre en attente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL MODIFICATION ===== */}
      {showEditModal && selectedPaiement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Modifier le paiement</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditPaiement} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Source</label>
                <p className="text-white text-sm">{getSourceLabel(selectedPaiement)}</p>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">ID Transaction (non modifiable)</label>
                <input
                  type="text"
                  value={selectedPaiement.transaction_id || ''}
                  disabled
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Montant (non modifiable)</label>
                <input
                  type="text"
                  value={selectedPaiement.montant ? `${selectedPaiement.montant.toLocaleString()} FCFA` : ''}
                  disabled
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Organisateur</label>
                <select
                  value={selectedPaiement.organisateur_id || ''}
                  onChange={(e) => setSelectedPaiement({ ...selectedPaiement, organisateur_id: e.target.value || null })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                >
                  <option value="">Non attribué</option>
                  {organisateurs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.structure || org.nom_associe || org.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Statut</label>
                <select
                  value={selectedPaiement.statut || 'en_attente'}
                  onChange={(e) => setSelectedPaiement({ ...selectedPaiement, statut: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                >
                  <option value="en_attente">En attente</option>
                  <option value="valide">Validé</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Modifier
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRIMER LA SÉLECTION ===== */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-8 h-8 text-red-400" />
              <h3 className="text-white font-semibold text-lg">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Vous êtes sur le point de supprimer <span className="text-red-400 font-bold">{selectedIds.length}</span> paiement(s).
            </p>
            <p className="text-gray-400 text-sm mb-4">Cette action est irréversible.</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSelectedModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingSelected}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingSelected ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer {selectedIds.length} paiement(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRIMER TOUT ===== */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-8 h-8 text-red-400" />
              <h3 className="text-white font-semibold text-lg">⚠️ Supprimer tous les paiements</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Vous êtes sur le point de supprimer <span className="text-red-400 font-bold">TOUS</span> les paiements ({paiements.length}).
            </p>
            <p className="text-red-400 text-sm font-bold mb-4">
              ⚠️ Cette action est irréversible et supprimera TOUS les paiements !
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingAll ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer tout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaiementsAdmin