/**
 * Page Connexion - Version corrigée
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - Redirection immédiate après connexion avec window.location.href
 * - Gestion des comptes expirés
 * - Vérification du plan pour les organisateurs
 * - ✅ CORRECTION : Redirection forcée pour éviter le rafraîchissement manuel
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, Loader, Phone, Mail as MailIcon } from 'lucide-react'

const Connexion = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiredAccount, setExpiredAccount] = useState(false)
  const [expiredEmail, setExpiredEmail] = useState('')
  const navigate = useNavigate()

  // ✅ Vérification de session existante
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, plan_expire')
            .eq('id', session.user.id)
            .single()
          
          if (profile) {
            if (profile.role === 'organisateur' && profile.plan_expire) {
              const now = new Date()
              const expire = new Date(profile.plan_expire)
              const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const expireDate = new Date(expire.getFullYear(), expire.getMonth(), expire.getDate())
              
              if (expireDate < nowDate) {
                setExpiredAccount(true)
                setExpiredEmail(session.user.email)
                return
              }
            }
            
            // ✅ REDIRECTION AVEC window.location.href (FORCÉE)
            if (profile.role === 'admin') {
              window.location.href = '/admin/dashboard'
            } else if (profile.role === 'organisateur') {
              window.location.href = '/organisateur/dashboard'
            } else {
              window.location.href = '/'
            }
          }
        }
      } catch (error) {
        console.error('Erreur de vérification de session:', error)
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setExpiredAccount(false)
    setLoading(true)

    if (!email || !email.includes('@')) {
      setError('Email invalide')
      setLoading(false)
      return
    }
    if (!password || password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError
      if (!data.user) throw new Error('Utilisateur non trouvé')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, statut, plan_id, plan_expire')
        .eq('id', data.user.id)
        .single()

      if (profileError) throw profileError
      if (!profile) throw new Error('Profil non trouvé')
      if (!profile.statut) throw new Error('Compte désactivé. Contactez l\'administrateur.')

      if (profile.role === 'organisateur') {
        if (!profile.plan_id) {
          setExpiredAccount(true)
          setExpiredEmail(email)
          setLoading(false)
          return
        }
        if (profile.plan_expire) {
          const now = new Date()
          const expire = new Date(profile.plan_expire)
          const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const expireDate = new Date(expire.getFullYear(), expire.getMonth(), expire.getDate())
          
          if (expireDate < nowDate) {
            setExpiredAccount(true)
            setExpiredEmail(email)
            setLoading(false)
            return
          }
        }
      }

      localStorage.setItem('faso-ticket-session', JSON.stringify({
        user: data.user,
        role: profile.role
      }))

      // ✅ REDIRECTION FORCÉE AVEC window.location.href
      // Cela garantit que la page est rechargée et que le dashboard s'affiche
      if (profile.role === 'admin') {
        window.location.href = '/admin/dashboard'
      } else if (profile.role === 'organisateur') {
        window.location.href = '/organisateur/dashboard'
      } else if (profile.role === 'agent') {
        window.location.href = '/agent/dashboard'
      } else {
        window.location.href = '/'
      }

    } catch (err) {
      setError(err.message || 'Erreur de connexion. Veuillez réessayer.')
      setLoading(false)
    }
  }

  // Affichage du compte expiré
  if (expiredAccount) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-800 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Compte expiré</h2>
          <p className="text-gray-400 text-sm mb-6">
            Votre compte a expiré. Contactez l'administrateur pour le réactiver.
            <br />
            <span className="text-gray-500 text-xs">Email : {expiredEmail}</span>
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
              href="https://wa.me/22601765372"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <Phone className="w-5 h-5" />
              WhatsApp : 01 765 372
            </a>
            <a
              href="mailto:fasoticket.burkindi@gmail.com"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <MailIcon className="w-5 h-5" />
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

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8 md:py-12">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            <span className="text-yellow-400">Connexion</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Connectez-vous à votre espace FASO TICKET
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="votre@email.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-12 py-2.5 text-white focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/mot-de-passe-oublie"
              className="text-yellow-400 hover:text-yellow-300 text-sm transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                Se connecter
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Pas encore de compte ?{' '}
            <Link to="/devenir-organisateur" className="text-yellow-400 hover:text-yellow-300 transition-colors font-medium">
              Devenir organisateur
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Connexion