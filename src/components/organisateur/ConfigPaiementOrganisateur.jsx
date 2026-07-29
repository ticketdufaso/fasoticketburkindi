/**
 * Configuration Paiement - Organisateur
 * Règles NASA 1-10
 * Version corrigée - Gestion des clés d'association et paiements clients
 * CORRECTIONS :
 * - La clé n'est plus générée automatiquement à la visualisation
 * - Affichage "Aucune clé générée" si pas de clé
 * - Bouton "Générer ma clé" pour créer la clé (1 seule fois pour Basique)
 * - Bouton "Générer une nouvelle clé" pour Premium (désactive les anciennes)
 * - Visualisation de la clé avec mot de passe (pas de régénération)
 * - Affiche UNIQUEMENT les paiements des clients (paiements_clients)
 * - Ajout manuel de paiement dans paiements_clients
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  DollarSign, Trash2, Edit, Search, Plus, Loader, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  CreditCard, Smartphone, User, Phone, ArrowLeft,
  Key, Copy, Shield, Lock, Crown, Zap
} from 'lucide-react'

const ConfigPaiementOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [paiements, setPaiements] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('tous')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [stats, setStats] = useState({ total: 0, enAttente: 0, valides: 0 })
  
  const [selectedPaiement, setSelectedPaiement] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  
  const [newPaiement, setNewPaiement] = useState({
    transaction_id: '',
    montant: '',
    numero_depot: ''
  })

  // ============================================================
  // ÉTATS POUR LA CLÉ D'ASSOCIATION
  // ============================================================
  
  const [cleAssociation, setCleAssociation] = useState('')
  const [cleLoading, setCleLoading] = useState(false)
  const [showCle, setShowCle] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordVerification, setPasswordVerification] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [copied, setCopied] = useState(false)
  const [cleExists, setCleExists] = useState(false)
  const [cleId, setCleId] = useState(null)
  const [planInfo, setPlanInfo] = useState({ nom: '', estPremium: false })
  const [generating, setGenerating] = useState(false)

  // Configuration du format USSD de l'organisateur
  const [configUssd, setConfigUssd] = useState({
    type_compte: 'courant',
    format_ussd: 'format_10',
    phone_om: '',
    code_marchand: '',
    nom_associe: ''
  })
  const [editingConfig, setEditingConfig] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchPaiements()
      fetchConfigUssd()
      fetchPlanInfo()
      fetchCleAssociation()
    }
  }, [user])

  // ============================================================
  // RÉCUPÉRATION DU PLAN DE L'ORGANISATEUR
  // ============================================================
  
  const fetchPlanInfo = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_id')
        .eq('id', user.id)
        .single()

      if (profileData && profileData.plan_id) {
        setPlanInfo({
          nom: profileData.plan_id,
          estPremium: profileData.plan_id === 'Premium'
        })
      }
    } catch (error) {
      console.error('Erreur récupération plan:', error)
    }
  }

  // ============================================================
  // GESTION DE LA CLÉ D'ASSOCIATION
  // ============================================================

  const fetchCleAssociation = async () => {
    try {
      setCleLoading(true)
      
      const { data: existingCle, error: checkError } = await supabase
        .from('association_tokens')
        .select('id, token_cle, actif')
        .eq('organisateur_id', user.id)
        .eq('actif', true)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingCle) {
        setCleAssociation(existingCle.token_cle)
        setCleId(existingCle.id)
        setCleExists(true)
      } else {
        setCleAssociation('')
        setCleId(null)
        setCleExists(false)
      }

    } catch (error) {
      console.error('Erreur récupération clé:', error)
      setError('Erreur lors de la récupération de la clé d\'association')
    } finally {
      setCleLoading(false)
    }
  }

  const handleGenererCle = async () => {
    setError('')
    setSuccess('')
    setGenerating(true)

    try {
      if (!planInfo.estPremium) {
        const { count, error: countError } = await supabase
          .from('association_tokens')
          .select('*', { count: 'exact', head: true })
          .eq('organisateur_id', user.id)

        if (countError) throw countError

        if (count > 0) {
          setError('❌ Vous avez déjà généré votre clé. (Plan Basique : 1 clé maximum)')
          setGenerating(false)
          return
        }
      }

      if (planInfo.estPremium) {
        const { error: updateError } = await supabase
          .from('association_tokens')
          .update({ actif: false, updated_at: new Date().toISOString() })
          .eq('organisateur_id', user.id)
          .eq('actif', true)

        if (updateError) {
          console.error('Erreur désactivation anciennes clés:', updateError)
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('structure, nom_associe, plan_expire')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const nom = profile.nom_associe || profile.structure || 'Organisateur'
      const dateExpiration = profile.plan_expire ? new Date(profile.plan_expire) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const { data: cle, error: cleError } = await supabase.rpc(
        'generer_cle_association',
        {
          p_organisateur_id: user.id,
          p_nom: nom,
          p_date_expiration: dateExpiration
        }
      )

      if (cleError) throw cleError

      setCleAssociation(cle)
      setCleExists(true)
      
      const { data: newCle, error: newCleError } = await supabase
        .from('association_tokens')
        .select('id')
        .eq('token_cle', cle)
        .single()

      if (!newCleError && newCle) {
        setCleId(newCle.id)
      }

      if (planInfo.estPremium) {
        setSuccess('✅ Nouvelle clé générée ! Les anciennes clés ont été désactivées.')
      } else {
        setSuccess('✅ Clé générée avec succès !')
      }
      
      setTimeout(() => setSuccess(''), 3000)

    } catch (error) {
      console.error('Erreur génération clé:', error)
      setError('Erreur lors de la génération de la clé: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setGenerating(false)
    }
  }

  const verifierMotDePasse = async (e) => {
    e.preventDefault()
    setPasswordError('')
    
    if (!passwordVerification || passwordVerification.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    try {
      const { data: { user: authUser }, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordVerification
      })

      if (signInError || !authUser) {
        setPasswordError('Mot de passe incorrect')
        return
      }

      setShowCle(true)
      setPasswordModalOpen(false)
      setPasswordVerification('')
      setPasswordError('')
      
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordVerification
      })

    } catch (error) {
      setPasswordError('Erreur lors de la vérification')
    }
  }

  const copyToClipboard = () => {
    if (!cleAssociation) return
    
    navigator.clipboard?.writeText(cleAssociation)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  // ============================================================
  // PAIEMENTS CLIENTS - CORRIGÉ
  // ============================================================

  const fetchPaiements = async () => {
    try {
      setLoading(true)
      
      // ✅ Afficher UNIQUEMENT les paiements des clients (paiements_clients)
      const { data, error } = await supabase
        .from('paiements_clients')
        .select('*')
        .eq('organisateur_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        // Si la table n'existe pas encore, afficher un message
        if (error.code === '42P01') {
          setPaiements([])
          setStats({ total: 0, enAttente: 0, valides: 0 })
          setLoading(false)
          return
        }
        throw error
      }

      const paiementsData = data || []
      setPaiements(paiementsData)

      const total = paiementsData.length
      const enAttente = paiementsData.filter(p => p.statut === 'en_attente').length
      const valides = paiementsData.filter(p => p.statut === 'valide').length

      setStats({ total, enAttente, valides })
    } catch (error) {
      console.error('Erreur:', error)
      setError('Erreur lors du chargement des paiements')
    } finally {
      setLoading(false)
    }
  }

  const fetchConfigUssd = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('type_compte, format_ussd, phone_om, code_marchand, nom_associe')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (data) {
        setConfigUssd({
          type_compte: data.type_compte || 'courant',
          format_ussd: data.format_ussd || 'format_10',
          phone_om: data.phone_om || '',
          code_marchand: data.code_marchand || '',
          nom_associe: data.nom_associe || ''
        })
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const saveConfigUssd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setConfigLoading(true)

    try {
      const updateData = {
        type_compte: configUssd.type_compte,
        format_ussd: configUssd.format_ussd,
        phone_om: configUssd.phone_om,
        code_marchand: configUssd.type_compte === 'commercial' && configUssd.format_ussd === 'format_3' ? configUssd.code_marchand : null,
        nom_associe: configUssd.nom_associe
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      setSuccess('Configuration sauvegardée avec succès !')
      setEditingConfig(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la sauvegarde')
    } finally {
      setConfigLoading(false)
    }
  }

  // ============================================================
  // AJOUT MANUEL D'UN PAIEMENT CLIENT - DANS paiements_clients
  // ============================================================

  const handleAddPaiement = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!newPaiement.transaction_id || newPaiement.transaction_id.length < 5) {
      setError('ID Transaction invalide')
      setSubmitting(false)
      return
    }
    if (!newPaiement.montant || parseInt(newPaiement.montant) <= 0) {
      setError('Montant invalide')
      setSubmitting(false)
      return
    }
    if (!newPaiement.numero_depot || !/^[0-9]{8}$/.test(newPaiement.numero_depot)) {
      setError('Numéro de dépôt invalide')
      setSubmitting(false)
      return
    }

    try {
      // ✅ Insertion dans paiements_clients (pas paiements_organisateurs)
      const { error } = await supabase
        .from('paiements_clients')
        .insert([{
          organisateur_id: user.id,
          transaction_id: newPaiement.transaction_id.trim(),
          montant: parseInt(newPaiement.montant),
          numero_depot: newPaiement.numero_depot.trim(),
          statut: 'en_attente',
          source: 'manuel'
        }])

      if (error) throw error

      setSuccess('✅ Paiement client ajouté avec succès')
      setShowAddModal(false)
      setNewPaiement({ transaction_id: '', montant: '', numero_depot: '' })
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setError('Erreur lors de l\'ajout: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // SUPPRESSION D'UN PAIEMENT CLIENT
  // ============================================================

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement client ?')) return

    try {
      const { error } = await supabase
        .from('paiements_clients')
        .delete()
        .eq('id', id)
        .eq('organisateur_id', user.id)

      if (error) throw error
      setSuccess('✅ Paiement client supprimé avec succès')
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression')
    }
  }

  // ============================================================
  // CHANGEMENT DE STATUT D'UN PAIEMENT CLIENT
  // ============================================================

  const handleStatusChange = async (id, statut) => {
    try {
      const { error } = await supabase
        .from('paiements_clients')
        .update({ 
          statut, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .eq('organisateur_id', user.id)

      if (error) throw error
      setSuccess(`✅ Statut changé en ${statut === 'valide' ? 'Validé' : 'En attente'}`)
      await fetchPaiements()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors du changement de statut')
    }
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  const getUssdFormat = () => {
    if (!configUssd.phone_om) return 'Configuration incomplète'
    
    if (configUssd.type_compte === 'commercial') {
      if (configUssd.format_ussd === 'format_3' && configUssd.code_marchand) {
        return `*144*3*${configUssd.code_marchand}*montant#`
      } else if (configUssd.format_ussd === 'format_10') {
        return `*144*10*${configUssd.phone_om}*montant#`
      }
    } else if (configUssd.type_compte === 'courant') {
      return `*144*2*1*${configUssd.phone_om}*montant#`
    }
    return 'Configuration invalide'
  }

  const getStatusBadge = (statut) => {
    const config = {
      'valide': { color: 'bg-green-500/20 text-green-400', label: '✅ Validé', icon: <CheckCircle className="w-3 h-3" /> },
      'en_attente': { color: 'bg-yellow-500/20 text-yellow-400', label: '⏳ En attente', icon: <AlertCircle className="w-3 h-3" /> },
      'rejete': { color: 'bg-red-500/20 text-red-400', label: '❌ Rejeté', icon: <XCircle className="w-3 h-3" /> },
      'double': { color: 'bg-orange-500/20 text-orange-400', label: '🔄 Doublon', icon: <AlertCircle className="w-3 h-3" /> }
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
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const filteredPaiements = paiements.filter(p => {
    const matchSearch = p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.numero_depot?.includes(searchTerm)
    const matchFilter = filter === 'tous' || p.statut === filter
    return matchSearch && matchFilter
  })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ===== BOUTON RETOUR ===== */}
      <button
        onClick={() => navigate('/organisateur/dashboard')}
        className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au dashboard
      </button>

      {/* ============================================================
          SECTION CLÉ D'ASSOCIATION
          ============================================================ */}
      <div className="bg-gray-900 rounded-xl border border-yellow-400/30 overflow-hidden shadow-lg shadow-yellow-400/5">
        <div className="p-4 md:p-6 border-b border-yellow-400/20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">🔑 Clé d'association Gateway</h2>
          </div>
          <div className="flex items-center gap-2">
            {planInfo.estPremium ? (
              <span className="text-yellow-400 text-xs font-medium flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Premium
              </span>
            ) : (
              <span className="text-gray-500 text-xs">Basique</span>
            )}
            <span className="text-gray-500 text-xs">
              {cleExists ? '✅ Clé générée' : '⏳ Aucune clé'}
            </span>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-700">
            <p className="text-gray-300 text-sm">
              Utilisez cette clé pour connecter votre application mobile <strong className="text-yellow-400">FASO TICKET Gateway</strong> à votre compte organisateur.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              📱 Cette clé est unique et liée à votre compte. Ne la partagez pas.
            </p>
            {!planInfo.estPremium && (
              <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                <p className="text-yellow-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Plan Basique : 1 clé maximum
                </p>
              </div>
            )}
            {planInfo.estPremium && (
              <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Plan Premium : Génération illimitée de clés
                </p>
              </div>
            )}
          </div>

          {cleLoading ? (
            <div className="flex justify-center py-4">
              <Loader className="w-6 h-6 text-yellow-400 animate-spin" />
            </div>
          ) : cleExists ? (
            <div>
              {showCle ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex-1 w-full">
                    <p className="text-gray-400 text-xs mb-1">Votre clé d'association :</p>
                    <code className="text-yellow-400 text-sm md:text-base font-mono break-all bg-black/50 px-3 py-2 rounded block">
                      {cleAssociation}
                    </code>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? 'Copié !' : 'Copier'}
                    </button>
                    <button
                      onClick={() => setShowCle(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex-1 text-center sm:text-left">
                    <Lock className="w-5 h-5 text-yellow-400 inline mr-2" />
                    <span className="text-gray-300 text-sm">
                      La clé est masquée pour des raisons de sécurité.
                    </span>
                  </div>
                  <button
                    onClick={() => setPasswordModalOpen(true)}
                    className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    Voir la clé
                  </button>
                </div>
              )}

              <div className="mt-4 flex justify-center">
                {planInfo.estPremium ? (
                  <button
                    onClick={handleGenererCle}
                    disabled={generating}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {generating ? 'Génération...' : 'Générer une nouvelle clé'}
                  </button>
                ) : (
                  <div className="text-gray-500 text-xs">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Plan Basique : 1 clé maximum déjà générée
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
              <Key className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-50" />
              <p className="text-gray-400 text-sm mb-2">Aucune clé générée</p>
              <p className="text-gray-500 text-xs mb-4">
                Cliquez sur le bouton ci-dessous pour générer votre clé d'association
              </p>
              <button
                onClick={handleGenererCle}
                disabled={generating || (!planInfo.estPremium && cleExists)}
                className={`flex items-center gap-2 mx-auto px-6 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  generating || (!planInfo.estPremium && cleExists)
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-400 hover:bg-yellow-300 text-black'
                }`}
              >
                {generating ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                {generating ? 'Génération...' : 'Générer ma clé'}
              </button>
              {!planInfo.estPremium && (
                <p className="text-gray-500 text-xs mt-2">
                  ⚠️ Une seule clé peut être générée avec le plan Basique
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL DE VÉRIFICATION DU MOT DE PASSE ===== */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">🔐 Vérification de sécurité</h3>
              <button
                onClick={() => {
                  setPasswordModalOpen(false)
                  setPasswordVerification('')
                  setPasswordError('')
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              Veuillez entrer votre mot de passe pour afficher votre clé d'association.
              <br />
              <span className="text-gray-500 text-xs">(La clé ne sera pas régénérée)</span>
            </p>

            <form onSubmit={verifierMotDePasse} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={passwordVerification}
                    onChange={(e) => setPasswordVerification(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="Entrez votre mot de passe"
                    required
                    autoFocus
                  />
                </div>
                {passwordError && (
                  <p className="text-red-400 text-xs mt-1">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalOpen(false)
                    setPasswordVerification('')
                    setPasswordError('')
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg transition-colors"
                >
                  Vérifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          CONFIGURATION USSD
          ============================================================ */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Configuration de paiement</h2>
          </div>
          <button
            onClick={() => setEditingConfig(!editingConfig)}
            className="text-yellow-400 hover:text-yellow-300 text-sm font-medium"
          >
            {editingConfig ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        <div className="p-4 md:p-6">
          {editingConfig ? (
            <form onSubmit={saveConfigUssd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Orange Money *</label>
                  <input
                    type="tel"
                    value={configUssd.phone_om}
                    onChange={(e) => setConfigUssd({ ...configUssd, phone_om: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="70123456"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Nom associé *</label>
                  <input
                    type="text"
                    value={configUssd.nom_associe}
                    onChange={(e) => setConfigUssd({ ...configUssd, nom_associe: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="Prénom NOM"
                    required
                  />
                  <p className="text-red-400 text-[10px] mt-1">⚠️ Inversez nom et prénom</p>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Type de compte *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-gray-300 text-sm">
                    <input
                      type="radio"
                      name="typeCompte"
                      value="courant"
                      checked={configUssd.type_compte === 'courant'}
                      onChange={(e) => setConfigUssd({ ...configUssd, type_compte: e.target.value, format_ussd: 'format_2' })}
                      className="accent-yellow-400"
                    />
                    Compte courant
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 text-sm">
                    <input
                      type="radio"
                      name="typeCompte"
                      value="commercial"
                      checked={configUssd.type_compte === 'commercial'}
                      onChange={(e) => setConfigUssd({ ...configUssd, type_compte: e.target.value })}
                      className="accent-yellow-400"
                    />
                    Compte commercial
                  </label>
                </div>
              </div>

              {configUssd.type_compte === 'commercial' && (
                <div className="p-3 bg-gray-800 rounded-lg">
                  <label className="text-gray-400 text-sm block mb-2">Format de paiement *</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-gray-300 text-sm">
                      <input
                        type="radio"
                        name="formatUssd"
                        value="format_3"
                        checked={configUssd.format_ussd === 'format_3'}
                        onChange={(e) => setConfigUssd({ ...configUssd, format_ussd: e.target.value })}
                        className="accent-yellow-400"
                      />
                      Format 3 (code marchand)
                    </label>
                    <label className="flex items-center gap-2 text-gray-300 text-sm">
                      <input
                        type="radio"
                        name="formatUssd"
                        value="format_10"
                        checked={configUssd.format_ussd === 'format_10'}
                        onChange={(e) => setConfigUssd({ ...configUssd, format_ussd: e.target.value })}
                        className="accent-yellow-400"
                      />
                      Format 10 (numéro)
                    </label>
                  </div>

                  {configUssd.format_ussd === 'format_3' && (
                    <div className="mt-3">
                      <label className="text-gray-400 text-sm block mb-1">Code marchand *</label>
                      <input
                        type="text"
                        value={configUssd.code_marchand}
                        onChange={(e) => setConfigUssd({ ...configUssd, code_marchand: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                        placeholder="12345678"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-xs mb-1">📋 Format de paiement généré :</p>
                <code className="text-yellow-400 text-sm font-mono break-all">
                  {getUssdFormat()}
                </code>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">{error}</div>}
              {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg">{success}</div>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingConfig(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={configLoading}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {configLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{configUssd.phone_om || 'Non configuré'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{configUssd.nom_associe || 'Non configuré'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">
                  {configUssd.type_compte === 'commercial' ? 'Compte commercial' : 'Compte courant'}
                  {configUssd.type_compte === 'commercial' && ` - ${configUssd.format_ussd === 'format_3' ? 'Format 3' : 'Format 10'}`}
                </span>
              </div>
              <div className="p-2 bg-gray-800 rounded-lg">
                <p className="text-gray-400 text-xs">Format de paiement :</p>
                <code className="text-yellow-400 text-sm font-mono">{getUssdFormat()}</code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          PAIEMENTS CLIENTS - CORRIGÉ
          ============================================================ */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <h2 className="text-white font-semibold">Paiements clients</h2>
              <span className="text-gray-400 text-sm">({stats.total})</span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ajouter manuellement
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
              <div className="text-yellow-400 text-xl font-bold">{stats.total}</div>
              <div className="text-gray-400 text-xs">Total</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center border border-yellow-500/20">
              <div className="text-yellow-400 text-xl font-bold">{stats.enAttente}</div>
              <div className="text-gray-400 text-xs">En attente</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center border border-green-500/20">
              <div className="text-green-400 text-xl font-bold">{stats.valides}</div>
              <div className="text-gray-400 text-xs">Validés</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher par ID ou numéro..."
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
              <option value="rejete">Rejetés</option>
            </select>
            <button
              onClick={fetchPaiements}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">{error}</div>}
          {success && <div className="mt-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg">{success}</div>}
        </div>

        {filteredPaiements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Aucun paiement client trouvé</p>
            <p className="text-sm text-gray-500">Les paiements de vos clients apparaîtront ici</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">ID Transaction</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Montant</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium hidden md:table-cell">N° Dépôt</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Statut</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPaiements.map((p) => (
                  <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm font-mono max-w-[120px] truncate">
                      {p.transaction_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-yellow-400 text-sm font-medium">
                      {p.montant?.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">
                      {p.numero_depot || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(p.statut)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedPaiement(p); setShowDetailsModal(true) }}
                          className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {p.statut === 'en_attente' && (
                          <button
                            onClick={() => handleStatusChange(p.id, 'valide')}
                            className="text-green-400 hover:text-green-300 transition-colors p-1"
                            title="Valider"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {p.statut === 'valide' && (
                          <button
                            onClick={() => handleStatusChange(p.id, 'en_attente')}
                            className="text-yellow-400 hover:text-yellow-300 transition-colors p-1"
                            title="Mettre en attente"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p.id)}
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

      {/* ===== MODAL AJOUT PAIEMENT CLIENT ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Ajouter un paiement client</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
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

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">{error}</div>}

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
                  {submitting ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAILS ===== */}
      {showDetailsModal && selectedPaiement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Détails du paiement client</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-xs">ID Transaction</p>
                <p className="text-white font-mono break-all">{selectedPaiement.transaction_id || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Montant</p>
                <p className="text-yellow-400 font-bold">{selectedPaiement.montant?.toLocaleString()} FCFA</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Numéro de dépôt</p>
                <p className="text-white">{selectedPaiement.numero_depot || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Statut</p>
                <p>{getStatusBadge(selectedPaiement.statut)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Source</p>
                <p className="text-white capitalize">{selectedPaiement.source || 'manuel'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Date de création</p>
                <p className="text-white">{formatDate(selectedPaiement.created_at)}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg"
              >
                Fermer
              </button>
              {selectedPaiement.statut === 'en_attente' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedPaiement.id, 'valide')
                    setShowDetailsModal(false)
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                >
                  Valider
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfigPaiementOrganisateur