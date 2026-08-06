/**
 * Page Devenir Organisateur
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * Version complète et finale - avec bouton retour
 * CORRECTIONS :
 * - ✅ Utilisation de l'ID réel du plan (UUID) au lieu du nom en minuscules
 * - ✅ Le lien vers paiement-plan utilise l'ID du plan (UUID)
 * - ✅ Plus de problèmes de casse
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Check, Crown, Ticket, Shield, Award, Users, ArrowLeft, Home, Loader, RefreshCw, AlertCircle, Radio, Key, Wifi } from 'lucide-react'

const DevenirOrganisateur = () => {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Fonction pour récupérer les plans depuis la base de données
  const fetchPlans = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError('')

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) {
        // Fallback en cas d'absence de données
        setPlans([
          {
            id: '11111111-1111-1111-1111-111111111111',
            nom: 'Basique',
            prix: 30000,
            duree: '1 mois',
            dureeJours: 30,
            icon: <Ticket className="w-6 h-6" />,
            color: 'bg-gray-800 text-gray-400',
            features: [
              '2 événements maximum',
              '2 agents maximum',
              '2 codes promo maximum',
              'Types de tickets : Simple, VIP',
              'Visibilité dans la boutique',
              '🔄 Génération unique de clé d\'association',
              '📱 Gateway SMS & Scanner'
            ],
            badge: null,
            raw: null
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            nom: 'Premium',
            prix: 50000,
            duree: '3 mois',
            dureeJours: 90,
            icon: <Crown className="w-6 h-6" />,
            color: 'bg-yellow-400/20 text-yellow-400',
            features: [
              '10 événements maximum',
              '5 agents maximum',
              '5 codes promo maximum',
              'Types : Simple, VIP, VVIP, Stand, Salon, Personnalisé',
              'Visibilité à la une',
              'Visibilité dans la boutique',
              'Codes promo illimités',
              'Statistiques avancées',
              'Export Excel / PDF',
              'Messagerie avec l\'administration',
              '🔄 Génération illimitée de clés d\'association',
              '📱 Gateway SMS & Scanner',
              '👥 Supervision des agents en temps réel'
            ],
            badge: 'RECOMMANDÉ',
            raw: null
          }
        ])
        setError('⚠️ Les plans par défaut sont utilisés. Les modifications admin ne seront pas visibles.')
        return
      }

      // Transformer les données de la base pour le format d'affichage
      const formattedPlans = data.map(plan => {
        const features = []
        
        if (plan.evenements_max) {
          features.push(`${plan.evenements_max} événements maximum`)
        }
        if (plan.agents_max) {
          features.push(`${plan.agents_max} agents maximum`)
        }
        if (plan.codes_max) {
          features.push(`${plan.codes_max} codes promo maximum`)
        }
        if (plan.types_tickets && plan.types_tickets.length > 0) {
          features.push(`Types de tickets : ${plan.types_tickets.join(', ')}`)
        }
        if (plan.visibilite_boutique) {
          features.push('Visibilité dans la boutique')
        }
        if (plan.visibilite_une) {
          features.push('Visibilité à la une')
        }
        if (plan.codes_promo_illimites) {
          features.push('Codes promo illimités')
        }
        if (plan.stats_avancees) {
          features.push('Statistiques avancées')
        }
        if (plan.export) {
          features.push('Export Excel / PDF')
        }
        if (plan.messagerie) {
          features.push('Messagerie avec l\'administration')
        }

        // AVANTAGES GATEWAY POUR LES DEUX PLANS
        if (plan.nom === 'Basique') {
          features.push('🔄 Génération unique de clé d\'association')
          features.push('📱 Gateway SMS & Scanner')
        }

        if (plan.nom === 'Premium') {
          features.push('🔄 Génération illimitée de clés d\'association')
          features.push('📱 Gateway SMS & Scanner (paiements automatiques)')
          features.push('👥 Supervision des agents en temps réel')
        }

        // Déterminer l'icône et la couleur
        const isPremium = plan.nom === 'Premium'
        const icon = isPremium ? <Crown className="w-6 h-6" /> : <Ticket className="w-6 h-6" />
        const color = isPremium ? 'bg-yellow-400/20 text-yellow-400' : 'bg-gray-800 text-gray-400'
        const badge = isPremium ? 'RECOMMANDÉ' : null
        const duree = plan.duree_jours ? `${plan.duree_jours} jours` : ''

        return {
          // ✅ CORRECTION : Utiliser l'ID réel du plan (UUID)
          // C'est plus fiable, sécurisé et durable car l'UUID ne change jamais
          id: plan.id,  // ← UUID réel de la table plans
          nom: plan.nom,
          prix: plan.prix,
          duree: duree,
          dureeJours: plan.duree_jours || 30,
          icon: icon,
          color: color,
          features: features,
          badge: badge,
          raw: plan
        }
      })

      setPlans(formattedPlans)
      setError('')

    } catch (error) {
      console.error('❌ Erreur chargement plans:', error)
      setError('Erreur lors du chargement des plans. Veuillez rafraîchir.')
      
      // Fallback en cas d'erreur
      setPlans([
        {
          id: '11111111-1111-1111-1111-111111111111',
          nom: 'Basique',
          prix: 30000,
          duree: '1 mois',
          dureeJours: 30,
          icon: <Ticket className="w-6 h-6" />,
          color: 'bg-gray-800 text-gray-400',
          features: [
            '2 événements maximum',
            '2 agents maximum',
            '2 codes promo maximum',
            'Types de tickets : Simple, VIP',
            'Visibilité dans la boutique',
            '🔄 Génération unique de clé d\'association',
            '📱 Gateway SMS & Scanner'
          ],
          badge: null,
          raw: null
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          nom: 'Premium',
          prix: 50000,
          duree: '3 mois',
          dureeJours: 90,
          icon: <Crown className="w-6 h-6" />,
          color: 'bg-yellow-400/20 text-yellow-400',
          features: [
            '10 événements maximum',
            '5 agents maximum',
            '5 codes promo maximum',
            'Types : Simple, VIP, VVIP, Stand, Salon, Personnalisé',
            'Visibilité à la une',
            'Visibilité dans la boutique',
            'Codes promo illimités',
            'Statistiques avancées',
            'Export Excel / PDF',
            'Messagerie avec l\'administration',
            '🔄 Génération illimitée de clés d\'association',
            '📱 Gateway SMS & Scanner',
            '👥 Supervision des agents en temps réel'
          ],
          badge: 'RECOMMANDÉ',
          raw: null
        }
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Chargement initial
  useEffect(() => {
    fetchPlans()
  }, [])

  // Rafraîchissement manuel
  const handleRefresh = () => {
    fetchPlans(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
        <p className="text-gray-400 ml-4">Chargement des plans...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ============================================================
            BOUTON DE RETOUR À L'ACCUEIL
            ============================================================ */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </button>
            <span className="text-gray-600">|</span>
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors"
            >
              <Home className="w-4 h-4" />
              Accueil
            </Link>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Rafraîchissement...' : 'Rafraîchir les prix'}
          </button>
        </div>

        {error && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm p-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-2xl md:text-4xl font-bold text-white">
            Devenir <span className="text-yellow-400">organisateur</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base mt-2 max-w-2xl mx-auto">
            Choisissez le plan qui correspond à vos besoins et commencez à vendre vos tickets en ligne
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-gray-900 rounded-2xl p-6 md:p-8 border-2 transition-all ${
                selectedPlan === plan.id 
                  ? 'border-yellow-400 shadow-lg shadow-yellow-400/10' 
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${plan.color}`}>
                    {plan.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white">{plan.nom}</h3>
                </div>
                {plan.badge && (
                  <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-yellow-400">
                  {plan.prix.toLocaleString()} FCFA
                </span>
                <span className="text-gray-400 text-sm ml-2">/ {plan.duree}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300 text-sm">
                    <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
                  selectedPlan === plan.id
                    ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                    : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                }`}
              >
                {selectedPlan === plan.id ? 'Plan sélectionné' : 'Choisir ce plan'}
              </button>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div className="mt-8 md:mt-10 text-center">
            {/* ✅ CORRECTION : Utiliser l'UUID réel du plan */}
            <Link
              to={`/paiement-plan/${selectedPlan}`}
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-8 py-3 rounded-xl transition-all transform hover:scale-105"
            >
              <Shield className="w-5 h-5" />
              Continuer vers le paiement
            </Link>
            <p className="text-gray-400 text-xs md:text-sm mt-3">
              Vous serez redirigé vers la page de paiement sécurisé
            </p>
          </div>
        )}

        <div className="mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <Award className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-300 text-xs md:text-sm">0% frais cachés</p>
          </div>
          <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <Shield className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-300 text-xs md:text-sm">100% sécurisé</p>
          </div>
          <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <Users className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-300 text-xs md:text-sm">Support 24/7</p>
          </div>
          <div className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <Ticket className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-300 text-xs md:text-sm">Tickets immédiats</p>
          </div>
        </div>

        {/* SECTION AVANTAGES PREMIUM EN DÉTAIL */}
        <div className="mt-12 md:mt-16 bg-gray-900/50 rounded-2xl p-6 md:p-8 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="w-8 h-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">
              Pourquoi choisir le plan <span className="text-yellow-400">Premium</span> ?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-yellow-400/10 p-2 rounded-lg">
                  <Radio className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold">Gateway SMS & Scanner</h3>
              </div>
              <p className="text-gray-400 text-sm">
                Recevez les paiements Orange Money automatiquement via l'application mobile. 
                Gérez vos entrées avec le scanner de tickets en temps réel.
                <br />
                <span className="text-yellow-400 text-xs">(Disponible aussi en Basique avec 1 clé)</span>
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-yellow-400/10 p-2 rounded-lg">
                  <Users className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold">Supervision en temps réel</h3>
              </div>
              <p className="text-gray-400 text-sm">
                Suivez en direct les performances de vos agents, le nombre d'entrées, 
                et recevez des alertes instantanées en cas de fraude ou de problème.
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-yellow-400/10 p-2 rounded-lg">
                  <Key className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold">Clés illimitées</h3>
              </div>
              <p className="text-gray-400 text-sm">
                Générez autant de clés d'association que vous voulez. 
                Changez de téléphone ou de session sans aucune restriction.
                <br />
                <span className="text-yellow-400 text-xs">(Basique : 1 clé maximum)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevenirOrganisateur