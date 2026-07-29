/**
 * Messagerie - Admin
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Sonnerie avec fichier audio + timestamp pour éviter le cache
 * - Badge +1 pour les nouveaux messages qui disparaît après lecture
 * - L'admin voit le nom de l'organisateur
 */

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  Send, MessageSquare, User, Mail, Loader, CheckCircle, 
  AlertCircle, Users, Lock, Hash, Crown, Phone, 
  Trash2, Plus, X, Search, Bell, BellOff, RefreshCw
} from 'lucide-react'

const MessagerieAdmin = () => {
  const { user } = useAuthContext()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [messages, setMessages] = useState([])
  const [organisateurs, setOrganisateurs] = useState([])
  const [admins, setAdmins] = useState([])
  const [selectedDiscussion, setSelectedDiscussion] = useState(null)
  const [discussionType, setDiscussionType] = useState('admin_public')
  const [reponse, setReponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const messagesEndRef = useRef(null)

  // ✅ TIMESTAMP POUR ÉVITER LE CACHE DU SON
  const getAudioUrl = () => {
    const timestamp = Date.now()
    return `/sounds/notification.mp3?t=${timestamp}`
  }

  // ============================================================
  // ✅ CORRECTION : SONNERIE AVEC FICHIER AUDIO + TIMESTAMP
  // ============================================================
  const playSound = () => {
    if (!soundEnabled) return
    
    try {
      const audio = new Audio(getAudioUrl())
      audio.volume = 0.5
      audio.play().catch(() => {
        // Ignorer les erreurs de lecture
      })
    } catch (e) {
      // Ignorer les erreurs
    }
  }

  // ============================================================
  // DEMANDER LA PERMISSION DE NOTIFICATION
  // ============================================================
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // ============================================================
  // SOUSCRIPTION EN TEMPS RÉEL
  // ============================================================
  useEffect(() => {
    const subscription = supabase
      .channel('messages_realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new
          
          const isConcerned = 
            newMsg.discussion_type === 'admin_public' ||
            (newMsg.discussion_type === 'admin_private' && 
              (newMsg.admin_id === user.id || newMsg.target_admin_id === user.id)) ||
            (newMsg.discussion_type === 'organisateur' && 
              newMsg.organisateur_id === selectedDiscussion?.id)

          if (isConcerned && !newMsg.is_deleted) {
            setMessages(prev => [...prev, newMsg])
            
            // ✅ CORRECTION : Sonnerie pour les messages des autres (admin ou organisateur)
            if (newMsg.sender !== 'admin' || newMsg.admin_id !== user.id) {
              playSound()
              setUnreadCount(prev => prev + 1)
              document.title = `📩 (${unreadCount + 1}) FASO TICKET`
              
              if (Notification.permission === 'granted') {
                const senderName = getSenderNameForNotif(newMsg)
                new Notification('📩 Nouveau message', {
                  body: `${senderName} : ${newMsg.message.substring(0, 50)}${newMsg.message.length > 50 ? '...' : ''}`,
                  icon: '/favicon.png'
                })
              }
            }
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        () => {
          fetchMessages()
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [selectedDiscussion, user.id, soundEnabled, unreadCount])

  // ============================================================
  // CHARGER LES DONNÉES
  // ============================================================
  useEffect(() => {
    if (selectedDiscussion) {
      fetchMessages()
    }
  }, [selectedDiscussion])

  useEffect(() => {
    fetchData()
    fetchUnreadCount()
  }, [])

  // ============================================================
  // RAFRAÎCHIR EN ARRIÈRE-PLAN
  // ============================================================
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchUnreadCount()
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: orgData } = await supabase
        .from('profiles')
        .select('id, structure, email, telephone, nom_associe, plan_id')
        .eq('role', 'organisateur')
        .eq('statut', true)
        .eq('plan_id', 'Premium')
        .order('structure', { ascending: true })

      setOrganisateurs(orgData || [])

      const { data: adminData } = await supabase
        .from('profiles')
        .select('id, structure, email, nom_associe, is_super_admin')
        .eq('role', 'admin')
        .eq('statut', true)
        .order('structure', { ascending: true })

      setAdmins(adminData || [])

    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (!selectedDiscussion) return

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (discussionType === 'organisateur') {
        query = query.eq('organisateur_id', selectedDiscussion.id)
      } else if (discussionType === 'admin_public') {
        query = query.eq('discussion_type', 'admin_public')
      } else if (discussionType === 'admin_private') {
        query = query
          .eq('discussion_type', 'admin_private')
          .or(`admin_id.eq.${user.id},target_admin_id.eq.${user.id}`)
      }

      const { data, error } = await query

      if (error) throw error
      setMessages(data || [])
      
      // ✅ Marquer les messages comme lus APRÈS le chargement
      await markMessagesAsRead()

      scrollToBottom()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  // ============================================================
  // ✅ CORRECTION : MARQUER LES MESSAGES COMME LUS
  // ============================================================
  const markMessagesAsRead = async () => {
    try {
      // Récupérer les messages non lus (qui ne sont pas de l'admin courant)
      const { data: unreadMessages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('is_deleted', false)
        .eq('lu', false)
        .neq('admin_id', user.id)
        .neq('sender', 'admin')

      if (error) throw error

      if (unreadMessages && unreadMessages.length > 0) {
        const ids = unreadMessages.map(m => m.id)
        
        // Marquer comme lus
        const { error: updateError } = await supabase
          .from('messages')
          .update({ lu: true })
          .in('id', ids)

        if (updateError) throw updateError

        // ✅ Mettre à jour le compteur
        await fetchUnreadCount()
      }
    } catch (error) {
      console.error('Erreur marquage lu:', error)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('is_deleted', false)
        .eq('lu', false)
        .neq('admin_id', user.id)
        .neq('sender', 'admin')

      if (error) throw error
      const count = data?.length || 0
      setUnreadCount(count)
      
      if (count > 0) {
        document.title = `📩 (${count}) FASO TICKET`
      } else {
        document.title = 'FASO TICKET - Billetterie sécurisée'
      }
    } catch (error) {
      console.error('Erreur comptage:', error)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    await fetchMessages()
    await fetchUnreadCount()
    setRefreshing(false)
    setSuccess('✅ Discussions actualisées')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!reponse.trim()) {
      setError('Veuillez écrire un message')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const adminInfo = admins.find(a => a.id === user.id)
      const senderName = adminInfo?.structure || adminInfo?.nom_associe || 'Administration'

      const messageData = {
        message: reponse.trim(),
        sender: 'admin',
        admin_id: user.id,
        sender_name: senderName,
        lu: false,
        is_deleted: false
      }

      if (discussionType === 'organisateur') {
        messageData.organisateur_id = selectedDiscussion.id
        messageData.discussion_type = 'organisateur'
      } else if (discussionType === 'admin_public') {
        messageData.discussion_type = 'admin_public'
      } else if (discussionType === 'admin_private') {
        messageData.discussion_type = 'admin_private'
        messageData.target_admin_id = selectedDiscussion.id
      }

      const { error } = await supabase
        .from('messages')
        .insert([messageData])

      if (error) throw error

      setSuccess('✅ Message envoyé')
      setReponse('')
      await fetchMessages()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de l\'envoi: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getSenderNameForNotif = (msg) => {
    if (msg.sender === 'organisateur') {
      const org = organisateurs.find(o => o.id === msg.organisateur_id)
      return org?.structure || 'Organisateur'
    }
    if (msg.sender === 'admin') {
      const admin = admins.find(a => a.id === msg.admin_id)
      return admin?.structure || admin?.nom_associe || 'Admin'
    }
    return msg.sender_name || 'Admin'
  }

  const getSenderName = (msg) => {
    if (msg.sender === 'organisateur') {
      const org = organisateurs.find(o => o.id === msg.organisateur_id)
      return org?.structure || 'Organisateur'
    }
    if (msg.sender === 'admin') {
      if (msg.admin_id === user.id) return 'Moi'
      const admin = admins.find(a => a.id === msg.admin_id)
      return admin?.structure || admin?.nom_associe || 'Admin'
    }
    return msg.sender_name || 'Admin'
  }

  const handleDeleteMessage = async (messageId) => {
    const message = messages.find(m => m.id === messageId)
    if (!message) {
      setError('Message non trouvé')
      return
    }
    
    if (message.admin_id !== user.id) {
      setError('❌ Vous ne pouvez supprimer que vos propres messages')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!confirm('Supprimer ce message ?')) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error
      
      setSuccess('✅ Message supprimé')
      await fetchMessages()
      await fetchUnreadCount()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteDiscussion = async () => {
    if (!confirm('⚠️ Supprimer définitivement cette discussion pour tous les participants ?')) return

    setIsDeleting(true)
    try {
      let query = supabase
        .from('messages')
        .delete()

      if (discussionType === 'organisateur') {
        query = query.eq('organisateur_id', selectedDiscussion.id)
      } else if (discussionType === 'admin_public') {
        query = query.eq('discussion_type', 'admin_public')
      } else if (discussionType === 'admin_private') {
        query = query
          .eq('discussion_type', 'admin_private')
          .or(`admin_id.eq.${user.id},target_admin_id.eq.${user.id}`)
      }

      const { error } = await query
      
      if (error) throw error

      setSuccess('✅ Discussion supprimée pour tous')
      setMessages([])
      
      setDiscussionType('admin_public')
      setSelectedDiscussion({ id: 'public', nom: 'Discussion publique' })
      await fetchMessages()
      await fetchUnreadCount()
      
      localStorage.setItem('faso-ticket-discussion', JSON.stringify({
        type: 'admin_public',
        discussion: { id: 'public', nom: 'Discussion publique' }
      }))
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSpecificDiscussion = async (discussionId, discussionType) => {
    if (!confirm('⚠️ Supprimer définitivement cette discussion pour tous les participants ?')) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    setIsDeleting(true)
    try {
      let query = supabase
        .from('messages')
        .delete()

      if (discussionType === 'organisateur') {
        query = query.eq('organisateur_id', discussionId)
      } else if (discussionType === 'admin_public') {
        query = query.eq('discussion_type', 'admin_public')
      } else if (discussionType === 'admin_private') {
        query = query
          .eq('discussion_type', 'admin_private')
          .or(`admin_id.eq.${user.id},target_admin_id.eq.${user.id}`)
      }

      const { error } = await query
      
      if (error) throw error

      setSuccess('✅ Discussion supprimée pour tous')
      
      if (selectedDiscussion?.id === discussionId) {
        setDiscussionType('admin_public')
        setSelectedDiscussion({ id: 'public', nom: 'Discussion publique' })
        await fetchMessages()
      }
      
      await fetchUnreadCount()
      await fetchData()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreatePrivateDiscussion = async (adminId) => {
    const targetAdmin = admins.find(a => a.id === adminId)
    if (!targetAdmin) return

    setDiscussionType('admin_private')
    setSelectedDiscussion(targetAdmin)
    setShowNewChatModal(false)
    await fetchMessages()
  }

  const getDiscussionTitle = () => {
    if (!selectedDiscussion) return 'Sélectionnez une discussion'
    
    if (discussionType === 'organisateur') {
      return selectedDiscussion.structure || 'Organisateur'
    } else if (discussionType === 'admin_public') {
      return '💬 Discussion publique'
    } else if (discussionType === 'admin_private') {
      return `🔒 Privé - ${selectedDiscussion.structure || selectedDiscussion.nom_associe || 'Admin'}`
    }
    return 'Discussion'
  }

  const filteredOrganisateurs = organisateurs.filter(org =>
    org.structure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.nom_associe?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
            <MessageSquare className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Messagerie</h2>
            {/* ✅ BADGE +1 pour les messages non lus */}
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 animate-pulse">
                +{unreadCount}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '...' : 'Refresh'}
            </button>
            <button
              onClick={() => {
                setDiscussionType('admin_public')
                setSelectedDiscussion({ id: 'public', nom: 'Discussion publique' })
                fetchMessages()
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                discussionType === 'admin_public'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <Hash className="w-4 h-4" />
              Public
            </button>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
            >
              <Lock className="w-4 h-4" />
              Privé
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-sm ${
                soundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}
              title={soundEnabled ? 'Sons activés' : 'Sons désactivés'}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-gray-400 text-xs mt-2">
          Organisateurs Premium uniquement • {organisateurs.length} organisateur(s)
        </p>
      </div>

      {/* ===== CONTENU ===== */}
      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* ===== LISTE DES DISCUSSIONS ===== */}
        <div className="md:w-1/3 border-r border-gray-800 p-4 max-h-[600px] overflow-y-auto">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
            />
          </div>

          {/* Discussion publique */}
          <div
            onClick={() => {
              setDiscussionType('admin_public')
              setSelectedDiscussion({ id: 'public', nom: 'Discussion publique' })
              fetchMessages()
            }}
            className={`w-full text-left p-3 rounded-lg transition-colors mb-2 cursor-pointer ${
              discussionType === 'admin_public'
                ? 'bg-yellow-400/10 border border-yellow-400/30'
                : 'hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-medium">💬 Discussion publique</span>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteSpecificDiscussion('public', 'admin_public')
                }}
                className="text-red-400 hover:text-red-300 transition-colors p-1 cursor-pointer"
                title="Supprimer cette discussion"
              >
                <Trash2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Discussions privées */}
          <p className="text-gray-500 text-xs mt-4 mb-2">Discussions privées</p>
          {admins.filter(a => a.id !== user.id).length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-2">Aucun autre admin</p>
          ) : (
            admins.filter(a => a.id !== user.id).map((admin) => (
              <div
                key={admin.id}
                onClick={() => {
                  setDiscussionType('admin_private')
                  setSelectedDiscussion(admin)
                  fetchMessages()
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors mb-1 cursor-pointer ${
                  discussionType === 'admin_private' && selectedDiscussion?.id === admin.id
                    ? 'bg-yellow-400/10 border border-yellow-400/30'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-yellow-400" />
                    <span className="text-white text-sm truncate">
                      {admin.structure || admin.nom_associe || 'Admin'}
                    </span>
                    {admin.is_super_admin && (
                      <Crown className="w-3 h-3 text-yellow-400" />
                    )}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSpecificDiscussion(admin.id, 'admin_private')
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors p-1 cursor-pointer"
                    title="Supprimer cette discussion"
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Organisateurs Premium */}
          <p className="text-gray-500 text-xs mt-4 mb-2">Organisateurs Premium</p>
          {filteredOrganisateurs.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              <User className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p>Aucun organisateur Premium</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOrganisateurs.map((org) => (
                <div
                  key={org.id}
                  onClick={() => {
                    setDiscussionType('organisateur')
                    setSelectedDiscussion(org)
                    fetchMessages()
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                    discussionType === 'organisateur' && selectedDiscussion?.id === org.id
                      ? 'bg-yellow-400/10 border border-yellow-400/30'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{org.structure || 'Organisateur'}</p>
                      <p className="text-gray-400 text-xs truncate">{org.email}</p>
                      <span className="text-yellow-400 text-[10px]">⭐ Premium</span>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSpecificDiscussion(org.id, 'organisateur')
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors p-1 cursor-pointer flex-shrink-0 ml-2"
                      title="Supprimer cette discussion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== ZONE DE DISCUSSION ===== */}
        <div className="md:w-2/3 flex flex-col">
          {selectedDiscussion ? (
            <>
              {/* ===== EN-TÊTE DISCUSSION ===== */}
              <div className="p-4 border-b border-gray-800 bg-gray-800/30 flex justify-between items-center">
                <div>
                  <p className="text-white font-semibold">{getDiscussionTitle()}</p>
                  {discussionType === 'organisateur' && selectedDiscussion.email && (
                    <p className="text-gray-400 text-xs flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {selectedDiscussion.email}
                      <Phone className="w-3 h-3 ml-2" />
                      {selectedDiscussion.telephone}
                    </p>
                  )}
                  {discussionType === 'admin_private' && (
                    <p className="text-yellow-400 text-xs">🔒 Discussion privée</p>
                  )}
                  {discussionType === 'admin_public' && (
                    <p className="text-gray-400 text-xs">👥 Visible par tous les admins</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markMessagesAsRead()}
                    className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                    title="Tout marquer comme lu"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteDiscussion}
                    disabled={isDeleting}
                    className="text-red-400 hover:text-red-300 transition-colors p-1 disabled:opacity-50"
                    title="Supprimer la discussion pour tous"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ===== MESSAGES ===== */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[400px] space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Aucun message</p>
                    <p className="text-sm text-gray-500">Commencez la discussion</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const senderName = getSenderName(msg)
                    const isOwn = msg.sender === 'admin' && msg.admin_id === user.id
                    const isFromAdmin = msg.sender === 'admin'
                    
                    return (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg max-w-[80%] relative group ${
                          isOwn
                            ? 'bg-yellow-400/20 border border-yellow-400/30 ml-auto'
                            : isFromAdmin
                            ? 'bg-blue-500/20 border border-blue-500/30'
                            : 'bg-gray-800 border border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              isOwn ? 'text-yellow-400' :
                              isFromAdmin ? 'text-blue-400' :
                              'text-gray-400'
                            }`}>
                              {isOwn ? 'Moi' : senderName}
                            </span>
                            <span className="text-gray-500 text-[10px]">
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {isOwn && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              disabled={isDeleting}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1 disabled:opacity-50"
                              title="Supprimer ce message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-white text-sm">{msg.message}</p>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ===== FORMULAIRE RÉPONSE ===== */}
              <div className="p-4 border-t border-gray-800">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <textarea
                    value={reponse}
                    onChange={(e) => setReponse(e.target.value)}
                    placeholder="Écrivez votre message..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 resize-none text-sm"
                    rows="2"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 self-end"
                  >
                    {submitting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer
                      </>
                    )}
                  </button>
                </form>
                {error && (
                  <div className="mt-2 text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-2 text-green-400 text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {success}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Sélectionnez une discussion</p>
                <p className="text-sm text-gray-500">Ou créez une nouvelle discussion</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL DISCUSSION PRIVÉE ===== */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-semibold text-lg">🔒 Nouvelle discussion privée</h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Sélectionnez un administrateur pour une discussion <span className="text-yellow-400">privée</span>.
              <br />
              <span className="text-gray-500 text-xs">La discussion ne sera visible que par vous et l'admin sélectionné.</span>
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {admins.filter(a => a.id !== user.id).map((admin) => (
                <button
                  key={admin.id}
                  onClick={() => handleCreatePrivateDiscussion(admin.id)}
                  className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">
                      {admin.structure || admin.nom_associe || 'Admin'}
                    </p>
                    {admin.is_super_admin && (
                      <Crown className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{admin.email}</p>
                </button>
              ))}
              {admins.filter(a => a.id !== user.id).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Aucun autre administrateur</p>
              )}
            </div>

            {error && (
              <div className="mt-4 text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MessagerieAdmin