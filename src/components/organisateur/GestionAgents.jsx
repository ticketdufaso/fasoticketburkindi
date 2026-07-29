/**
 * Gestion des Agents - Organisateur
 * Règles NASA 1-10
 * VERSION FINALE - TABLE agents UNIQUEMENT
 * 
 * CORRECTIONS :
 * - Les agents sont stockés UNIQUEMENT dans la table agents
 * - AUCUNE insertion dans profiles
 * - Utilisation des RPC check_agent_exists et check_auth_user_exists
 * - Gestion simplifiée des permissions
 * - Performance des agents (scans réussis/échecs)
 * - Lien vers la supervision
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Users, UserPlus, Trash2, Eye, Loader, RefreshCw,
  Search, Mail, Lock, CheckCircle, XCircle,
  AlertCircle, ArrowLeft, Smartphone, User,
  Wifi, WifiOff, Activity, BarChart3, EyeOff,
  Shield, Crown, Star, Award, TrendingUp
} from 'lucide-react'

const GestionAgents = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState([])
  const [agentPerformance, setAgentPerformance] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [planInfo, setPlanInfo] = useState({ agentsMax: 0, estPremium: false })
  const [gatewayStatus, setGatewayStatus] = useState({})

  const [formData, setFormData] = useState({
    nom_complet: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (user) {
      fetchAgents()
      fetchPlanInfo()
      fetchGatewayStatus()
    }
  }, [user])

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
          .select('agents_max, nom')
          .eq('nom', profileData.plan_id)
          .single()

        if (planData) {
          setPlanInfo({
            agentsMax: planData.agents_max || 0,
            estPremium: planData.nom === 'Premium'
          })
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchGatewayStatus = async () => {
    try {
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
          tokenAssocie: tokenData.token_cle
        })
      } else {
        setGatewayStatus({
          estActif: false,
          derniereConnexion: null,
          tokenAssocie: null
        })
      }
    } catch (error) {
      console.error('Erreur récupération statut Gateway:', error)
    }
  }

  // ============================================================
  // RÉCUPÉRATION DES AGENTS DEPUIS LA TABLE agents
  // ============================================================

  const fetchAgents = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('organisateur_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])

      if (data && data.length > 0) {
        await fetchAgentPerformance(data)
      }

    } catch (error) {
      console.error('Erreur:', error)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentPerformance = async (agentsList) => {
    try {
      const performance = {}
      
      for (const agent of agentsList) {
        const { count: succes, error: sError } = await supabase
          .from('scans_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .eq('statut', 'succes')

        if (sError) {
          performance[agent.id] = { succes: 0, echecs: 0, total: 0 }
          continue
        }

        const { count: echecs, error: eError } = await supabase
          .from('scans_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .in('statut', ['echec', 'fraude', 'doublon'])

        if (eError) {
          performance[agent.id] = { 
            succes: succes || 0, 
            echecs: 0, 
            total: succes || 0 
          }
          continue
        }

        performance[agent.id] = {
          succes: succes || 0,
          echecs: echecs || 0,
          total: (succes || 0) + (echecs || 0)
        }
      }

      setAgentPerformance(performance)
    } catch (error) {
      console.error('Erreur performance:', error)
    }
  }

  // ============================================================
  // CRÉATION D'UN AGENT - UNIQUEMENT DANS agents (PAS profiles)
  // ============================================================

  const handleAddAgent = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    // --- VALIDATION ---
    if (!formData.nom_complet || formData.nom_complet.length < 2) {
      setError('Nom complet invalide')
      setSubmitting(false)
      return
    }
    if (!formData.email || !formData.email.includes('@')) {
      setError('Email invalide')
      setSubmitting(false)
      return
    }
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setSubmitting(false)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setSubmitting(false)
      return
    }

    if (agents.length >= planInfo.agentsMax) {
      setError(`Vous avez atteint la limite de ${planInfo.agentsMax} agents pour votre plan`)
      setSubmitting(false)
      return
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

      if (!serviceKey) {
        throw new Error('Clé de service non configurée. Vérifiez vos variables d\'environnement.')
      }

      let userId = null
      let authExists = false

      // --- 1. Vérifier si l'utilisateur existe déjà dans auth.users ---
      console.log('🔍 Vérification de l\'email dans auth:', formData.email)
      
      try {
        const { data: userCheck, error: checkError } = await supabase
          .rpc('check_auth_user_exists', { p_email: formData.email })

        if (!checkError && userCheck && userCheck.length > 0) {
          userId = userCheck[0].user_id
          authExists = true
          console.log('📦 Utilisateur auth existant:', userId)
        }
      } catch (rpcError) {
        console.warn('⚠️ RPC check_auth_user_exists échoué:', rpcError)
      }

      // --- 2. Si l'utilisateur n'existe pas, le créer ---
      if (!authExists) {
        console.log('📝 Création de l\'utilisateur dans auth...')
        
        const userData = {
          email: formData.email,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            nom_complet: formData.nom_complet,
            role: 'agent'
          }
        }

        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ Erreur création auth:', errorData)
          
          if (errorData.msg && errorData.msg.includes('already registered')) {
            const listResponse = await fetch(
              `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(formData.email)}`,
              {
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'apikey': serviceKey
                }
              }
            )
            
            if (listResponse.ok) {
              const listData = await listResponse.json()
              if (listData.users && listData.users.length > 0) {
                userId = listData.users[0].id
                authExists = true
                console.log('✅ Utilisateur récupéré:', userId)
              }
            }
          }
          
          if (!userId) {
            throw new Error(errorData.msg || errorData.message || 'Erreur lors de la création')
          }
        } else {
          const authData = await response.json()
          userId = authData.id
          authExists = true
          console.log('✅ Utilisateur auth créé:', userId)
        }
      }

      if (!userId) {
        throw new Error('ID utilisateur non disponible')
      }

      // --- 3. Vérifier si l'agent existe déjà dans la table agents ---
      const { data: existingAgent, error: checkAgentError } = await supabase
        .from('agents')
        .select('id, email, nom_complet')
        .eq('email', formData.email)
        .maybeSingle()

      if (checkAgentError && checkAgentError.code !== 'PGRST116') {
        console.error('Erreur vérification agent:', checkAgentError)
      }

      if (existingAgent) {
        // L'agent existe déjà → mettre à jour
        console.log('📦 Agent existant:', existingAgent)

        const { error: updateError } = await supabase
          .from('agents')
          .update({
            nom_complet: formData.nom_complet,
            statut: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAgent.id)

        if (updateError) throw updateError

        setSuccess('Agent mis à jour avec succès !')
      } else {
        // ✅ L'agent n'existe pas → créer UNIQUEMENT dans la table agents
        // ✅ AUCUNE insertion dans profiles
        console.log('✅ Création de l\'agent dans la table agents (UNIQUEMENT)')

        const agentData = {
          id: userId,
          organisateur_id: user.id,
          nom_complet: formData.nom_complet,
          email: formData.email,
          statut: true
        }

        const { error: insertError } = await supabase
          .from('agents')
          .insert([agentData])

        if (insertError) {
          console.error('❌ Erreur insertion agent:', insertError)
          throw insertError
        }

        setSuccess('Agent créé avec succès !')
      }

      setShowAddModal(false)
      setFormData({ nom_complet: '', email: '', password: '', confirmPassword: '' })
      await fetchAgents()
      setTimeout(() => setSuccess(''), 3000)

    } catch (error) {
      console.error('❌ Erreur création agent:', error)
      setError(error.message || 'Erreur lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // SUPPRESSION D'UN AGENT
  // ============================================================

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet agent ?')) return

    try {
      // Supprimer de la table agents
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)
        .eq('organisateur_id', user.id)

      if (error) throw error
      
      setSuccess('Agent supprimé avec succès')
      await fetchAgents()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression')
    }
  }

  // ============================================================
  // CHANGEMENT DE STATUT D'UN AGENT
  // ============================================================

  const handleToggleStatus = async (agentId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ 
          statut: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .eq('organisateur_id', user.id)

      if (error) throw error
      setSuccess(`Agent ${currentStatus ? 'désactivé' : 'activé'} avec succès`)
      await fetchAgents()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors du changement de statut')
    }
  }

  const getStatusBadge = (statut) => {
    return statut ? (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Actif</span>
    ) : (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Inactif</span>
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

  const filteredAgents = agents.filter(a =>
    a.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/organisateur/dashboard')}
            className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Gestion des <span className="text-yellow-400">agents</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {agents.length} / {planInfo.agentsMax} agents
              {planInfo.estPremium && (
                <span className="ml-2 text-yellow-400 text-xs font-medium">⭐ Premium</span>
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => navigate('/organisateur/supervision')}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              Supervision
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Nouvel agent
            </button>
          </div>
        </div>

        {/* ===== STATUT DU GATEWAY ===== */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-yellow-400" />
            <div className="flex-1">
              <p className="text-gray-300 text-sm">
                Les agents créés peuvent se connecter à l'application mobile pour scanner les tickets.
              </p>
              <div className="flex items-center gap-4 mt-1">
                <span className={`text-xs flex items-center gap-1 ${
                  gatewayStatus.estActif ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {gatewayStatus.estActif ? (
                    <><Wifi className="w-3 h-3" /> Gateway actif</>
                  ) : (
                    <><WifiOff className="w-3 h-3" /> Gateway inactif</>
                  )}
                </span>
                {gatewayStatus.derniereConnexion && (
                  <span className="text-gray-500 text-xs">
                    Dernière connexion : {formatDate(gatewayStatus.derniereConnexion)}
                  </span>
                )}
                <button
                  onClick={() => navigate('/organisateur/guide-gateway')}
                  className="text-yellow-400 hover:text-yellow-300 text-xs font-medium"
                >
                  Configurer le Gateway →
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher un agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
          />
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

        {filteredAgents.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-30" />
            <p className="text-gray-400 text-lg">Aucun agent</p>
            <p className="text-gray-500 text-sm">Créez votre premier agent pour gérer vos événements</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Créer un agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const perf = agentPerformance[agent.id] || { succes: 0, echecs: 0, total: 0 }
              const taux = perf.total > 0 ? Math.round((perf.succes / perf.total) * 100) : 0
              
              return (
                <div key={agent.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-yellow-400/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{agent.nom_complet}</h3>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {agent.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {getStatusBadge(agent.statut)}
                        <span className="text-gray-500 text-xs">
                          Créé le {formatDate(agent.created_at)}
                        </span>
                      </div>
                      
                      {/* Performance */}
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Performance
                          </span>
                          <span className={`text-xs font-medium ${
                            taux >= 80 ? 'text-green-400' : taux >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {perf.total > 0 ? `${taux}% (${perf.succes}/${perf.total})` : 'Aucun scan'}
                          </span>
                        </div>
                        {perf.total > 0 && (
                          <div className="mt-1 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                taux >= 80 ? 'bg-green-400' : taux >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(taux, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setSelectedAgent(agent); setShowDetailsModal(true) }}
                        className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(agent.id, agent.statut)}
                        className={`transition-colors p-1 ${
                          agent.statut ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                        }`}
                        title={agent.statut ? 'Désactiver' : 'Activer'}
                      >
                        {agent.statut ? <EyeOff className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Ajout Agent */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Ajouter un agent</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nom complet *</label>
                <input
                  type="text"
                  value={formData.nom_complet}
                  onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="Nom complet"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="agent@email.com"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Mot de passe *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="8 caractères min"
                  required
                  minLength="8"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Confirmer le mot de passe *</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                  placeholder="Confirmer"
                  required
                />
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">{error}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg disabled:opacity-50">
                  {submitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails Agent */}
      {showDetailsModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Détails de l'agent</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div><p className="text-gray-400 text-xs">Nom complet</p><p className="text-white">{selectedAgent.nom_complet}</p></div>
              <div><p className="text-gray-400 text-xs">Email</p><p className="text-white">{selectedAgent.email}</p></div>
              <div><p className="text-gray-400 text-xs">Rôle</p><p className="text-white font-medium">Agent</p></div>
              <div><p className="text-gray-400 text-xs">Statut</p><p>{getStatusBadge(selectedAgent.statut)}</p></div>
              <div><p className="text-gray-400 text-xs">Créé par</p><p className="text-white">Vous</p></div>
              <div><p className="text-gray-400 text-xs">Date de création</p><p className="text-white">{formatDate(selectedAgent.created_at)}</p></div>
              
              {/* Performance */}
              <div className="pt-3 border-t border-gray-800">
                <p className="text-gray-400 text-xs mb-2">Performance</p>
                {agentPerformance[selectedAgent.id] ? (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-green-400 font-bold">{agentPerformance[selectedAgent.id].succes}</p>
                        <p className="text-gray-500 text-xs">✅ Succès</p>
                      </div>
                      <div>
                        <p className="text-red-400 font-bold">{agentPerformance[selectedAgent.id].echecs}</p>
                        <p className="text-gray-500 text-xs">❌ Échecs</p>
                      </div>
                      <div>
                        <p className="text-yellow-400 font-bold">{agentPerformance[selectedAgent.id].total}</p>
                        <p className="text-gray-500 text-xs">📊 Total</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Aucune performance enregistrée</p>
                )}
              </div>
              
              <div><p className="text-gray-400 text-xs">Accès</p><p className="text-gray-400">📱 Uniquement application mobile</p></div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => navigate('/organisateur/supervision')}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Voir sa performance
              </button>
              <button onClick={() => setShowDetailsModal(false)} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GestionAgents