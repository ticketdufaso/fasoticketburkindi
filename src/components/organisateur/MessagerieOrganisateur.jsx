/**
 * Messagerie - Organisateur (Premium uniquement)
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Sonnerie avec fichier audio + timestamp pour éviter le cache
 * - Badge +1 qui disparaît après lecture
 * - L'organisateur voit "Administration"
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  ArrowLeft, Send, MessageSquare, User, Mail, Phone, 
  Loader, CheckCircle, AlertCircle, Lock, Bell, BellOff,
  RefreshCw
} from 'lucide-react'

const MessagerieOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
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
    if (!user) return

    const subscription = supabase
      .channel('messages_organisateur_realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new
          
          if (newMsg.organisateur_id === user.id && !newMsg.is_deleted) {
            setMessages(prev => [...prev, newMsg])
            
            // ✅ CORRECTION : Sonnerie pour les messages de l'admin uniquement
            if (newMsg.sender === 'admin') {
              playSound()
              setUnreadCount(prev => prev + 1)
              document.title = `📩 (${unreadCount + 1}) FASO TICKET`
              
              if (Notification.permission === 'granted') {
                new Notification('📩 Nouveau message de l\'administration', {
                  body: `Administration : ${newMsg.message.substring(0, 50)}${newMsg.message.length > 50 ? '...' : ''}`,
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
  }, [user, soundEnabled, unreadCount])

  // ============================================================
  // CHARGER LES DONNÉES
  // ============================================================
  useEffect(() => {
    checkPlan()
    fetchMessages()
    fetchUnreadCount()
  }, [user])

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

  const checkPlan = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('plan_id')
        .eq('id', user.id)
        .single()
      
      if (data && data.plan_id === 'Premium') {
        setIsPremium(true)
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchMessages = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('organisateur_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
      
      // ✅ Marquer les messages comme lus APRÈS le chargement
      await markMessagesAsRead()

      scrollToBottom()
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // ✅ CORRECTION : MARQUER LES MESSAGES COMME LUS
  // ============================================================
  const markMessagesAsRead = async () => {
    if (!user) return

    try {
      // Récupérer les messages non lus de l'admin
      const { data: unreadMessages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('organisateur_id', user.id)
        .eq('is_deleted', false)
        .eq('lu', false)
        .eq('sender', 'admin')

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

  // ✅ CORRECTION : RÉCUPÉRER LE NOMBRE DE MESSAGES NON LUS
  const fetchUnreadCount = async () => {
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
    await fetchMessages()
    await fetchUnreadCount()
    setRefreshing(false)
    setSuccess('✅ Messages actualisés')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!isPremium) {
      setError('Cette fonctionnalité est réservée aux utilisateurs Premium')
      return
    }
    
    if (!newMessage.trim()) {
      setError('Veuillez écrire un message')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          organisateur_id: user.id,
          message: newMessage.trim(),
          sender: 'organisateur',
          lu: false,
          is_deleted: false,
          discussion_type: 'organisateur'
        }])

      if (error) throw error

      setSuccess('✅ Message envoyé avec succès')
      setNewMessage('')
      await fetchMessages()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de l\'envoi: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getSenderName = (msg) => {
    if (msg.sender === 'organisateur') {
      return 'Moi'
    }
    if (msg.sender === 'admin') {
      return 'Administration'
    }
    return 'Administration'
  }

  if (!isPremium && !loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-800 text-center">
          <Lock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Accès Premium requis</h2>
          <p className="text-gray-400 text-sm mb-6">
            La messagerie est disponible uniquement pour les utilisateurs du plan Premium.
          </p>
          <button
            onClick={() => navigate('/organisateur/dashboard')}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-lg transition-colors"
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
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/organisateur/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '...' : 'Refresh'}
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

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">
              <span className="text-yellow-400">Messagerie</span> avec l'administration
            </h1>
            {/* ✅ BADGE +1 pour les messages non lus */}
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 animate-pulse">
                +{unreadCount}
              </span>
            )}
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

          {/* Messages */}
          <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Aucun message</p>
                <p className="text-sm text-gray-500">Envoyez un message à l'administration</p>
              </div>
            ) : (
              messages.map((msg) => {
                const senderName = getSenderName(msg)
                const isOwn = msg.sender === 'organisateur'
                
                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg border ${
                      isOwn 
                        ? 'bg-gray-800 border-gray-700 ml-auto max-w-[80%]' 
                        : 'bg-yellow-400/10 border-yellow-400/20 max-w-[80%]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {isOwn ? (
                          <User className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <Mail className="w-4 h-4 text-blue-400" />
                        )}
                        <span className={`text-sm font-medium ${
                          isOwn ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                          {isOwn ? 'Moi' : senderName}
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mt-2">{msg.message}</p>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulaire d'envoi */}
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message à l'administration..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-400 resize-none"
              rows="3"
              maxLength="1000"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 self-end"
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
          
          <p className="text-gray-500 text-xs mt-3 text-center">
            ⭐ Vous êtes Premium - Messagerie disponible 24/7
          </p>
        </div>
      </div>
    </div>
  )
}

export default MessagerieOrganisateur