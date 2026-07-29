/**
 * Guide d'installation - Organisateur
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * Version complète - Parcours pédagogique obligatoire
 * CORRECTIONS :
 * - APK téléchargeable pour TOUS les organisateurs (Basique ET Premium)
 * - Adaptation du contenu selon le plan (1 clé pour Basique, illimité pour Premium)
 * - Message d'information pour Basique sur la limite de clés
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { 
  ArrowLeft, Download, Shield, Eye, EyeOff, Lock, Copy,
  Smartphone, MessageSquare, Zap, Users, CheckCircle, 
  AlertCircle, Loader, Phone, Mail, Key, Crown,
  ChevronRight, ChevronLeft, Home, Clock, Wifi, WifiOff
} from 'lucide-react'

const GuideInstallationOrganisateur = () => {
  const { user } = useAuthContext()
  const navigate = useNavigate()
  
  // État du guide
  const [currentStep, setCurrentStep] = useState(0)
  const [stepCompleted, setStepCompleted] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [countdownActive, setCountdownActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // État du plan
  const [planInfo, setPlanInfo] = useState({ nom: '', estPremium: false })
  
  // État de la clé d'association
  const [cleAssociation, setCleAssociation] = useState('')
  const [showCle, setShowCle] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordVerification, setPasswordVerification] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [copied, setCopied] = useState(false)
  const [cleExists, setCleExists] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  // État de l'engagement
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false)
  
  // État du téléchargement
  const [downloading, setDownloading] = useState(false)
  const [apkUrl, setApkUrl] = useState('')
  const [apkVersion, setApkVersion] = useState('')
  
  // Références
  const countdownInterval = useRef(null)

  // Contenu des étapes
  const steps = [
    {
      id: 0,
      title: '📱 Installation de l\'APK',
      icon: <Shield className="w-8 h-8 text-yellow-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm md:text-base">
            L'application <strong className="text-yellow-400">FASO TICKET Gateway</strong> ne provient pas du Google Play Store en raison des restrictions strictes de Google sur la vie privée.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm font-medium">🔧 Procédure d'installation :</p>
            <ol className="text-gray-300 text-sm mt-2 space-y-2 list-decimal list-inside">
              <li>Téléchargez le fichier APK à la fin de ce guide</li>
              <li>Ouvrez le fichier téléchargé</li>
              <li>Si un message d'avertissement apparaît, appuyez sur <strong>"Autoriser"</strong></li>
              <li>Allez dans <strong>Paramètres &gt; Sécurité &gt; Sources inconnues</strong></li>
              <li>Activez <strong>"Autoriser l'installation d'applications de sources inconnues"</strong></li>
              <li>Retournez au fichier APK et appuyez sur <strong>"Installer"</strong></li>
            </ol>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Sur certains téléphones (Xiaomi, Redmi, etc.), l'option se trouve dans Paramètres &gt; Applications &gt; Installer à partir de sources inconnues
            </p>
          </div>
        </div>
      )
    },
    {
      id: 1,
      title: '🔍 Capture des SMS Orange Money',
      icon: <MessageSquare className="w-8 h-8 text-yellow-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm md:text-base">
            L'application va intercepter <strong className="text-yellow-400">tous les SMS entrants</strong> sur votre téléphone pour détecter les paiements Orange Money.
          </p>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-green-400 text-sm font-medium">🛡️ Protection de vos données :</p>
            <ul className="text-gray-300 text-sm mt-2 space-y-2 list-disc list-inside">
              <li>Un filtre strict vérifie l'expéditeur du SMS</li>
              <li>Seuls les SMS <strong>d'Orange Money</strong> sont analysés</li>
              <li>Les autres SMS sont <strong>instantanément détruits</strong> de la mémoire</li>
              <li>Aucune donnée personnelle n'est stockée sur nos serveurs</li>
              <li>Seules les <strong>transactions financières</strong> sont transmises</li>
            </ul>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              L'application demande une permission spéciale pour lire les SMS. Vous devrez l'accepter pour que le système fonctionne.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: '⚡ Persistance en arrière-plan',
      icon: <Zap className="w-8 h-8 text-yellow-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm md:text-base">
            Android tue souvent les applications pour économiser la batterie. Pour garantir un fonctionnement <strong className="text-yellow-400">24h/24 et 7j/7</strong>, vous devez configurer quelques paramètres.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm font-medium">⚙️ Configuration nécessaire :</p>
            <ol className="text-gray-300 text-sm mt-2 space-y-2 list-decimal list-inside">
              <li>Allez dans <strong>Paramètres &gt; Applications</strong></li>
              <li>Trouvez <strong>"FASO TICKET Gateway"</strong></li>
              <li>Appuyez sur <strong>"Lancement automatique"</strong> (Autostart) → Activez</li>
              <li>Appuyez sur <strong>"Économiseur de batterie"</strong> → Sélectionnez <strong>"Aucune restriction"</strong></li>
              <li>Activez <strong>"Autoriser l'exécution en arrière-plan"</strong></li>
            </ol>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              ⚠️ Si vous ne faites pas ces étapes, l'application sera fermée automatiquement par Android et vous ne recevrez plus les paiements !
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              💡 Pour les téléphones Xiaomi/Redmi (MIUI/HyperOS), une notification persistante apparaîtra. <strong>Ne la fermez pas</strong>, c'est elle qui maintient l'application active.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: '👥 Accès Agent de Scan',
      icon: <Users className="w-8 h-8 text-yellow-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm md:text-base">
            L'application sert aussi à vos <strong className="text-yellow-400">contrôleurs</strong> à la porte pour scanner les tickets des clients.
          </p>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-green-400 text-sm font-medium">👤 Création des comptes agents :</p>
            <ol className="text-gray-300 text-sm mt-2 space-y-2 list-decimal list-inside">
              <li>Allez dans votre <strong>Dashboard organisateur</strong></li>
              <li>Cliquez sur <strong>"Gestion des agents"</strong></li>
              <li>Appuyez sur <strong>"Nouvel agent"</strong></li>
              <li>Saisissez : <strong>Email</strong> et <strong>Mot de passe</strong></li>
              <li>L'agent pourra se connecter à l'application mobile</li>
            </ol>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Chaque agent a son propre compte. Vous pouvez suivre leurs performances en temps réel dans votre dashboard.
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              💡 Les agents peuvent scanner plusieurs événements en même temps. Chaque scan est horodaté et traçable.
            </p>
          </div>
        </div>
      )
    }
  ]

  // ============================================================
  // RÉCUPÉRATION DU PLAN
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
  // CHARGEMENT DE LA CLÉ D'ASSOCIATION
  // ============================================================

  useEffect(() => {
    const fetchCleAssociation = async () => {
      try {
        setIsLoading(true)
        
        await fetchPlanInfo()
        
        // Vérifier si une clé existe déjà
        const { data: existingCle, error: checkError } = await supabase
          .from('association_tokens')
          .select('token_cle, actif')
          .eq('organisateur_id', user.id)
          .eq('actif', true)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }

        if (existingCle) {
          setCleAssociation(existingCle.token_cle)
          setCleExists(true)
        } else {
          setCleExists(false)
        }

        // Récupérer l'URL de l'APK
        await fetchApkInfo()

      } catch (error) {
        console.error('Erreur:', error)
        setError('Erreur lors du chargement des données')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCleAssociation()
  }, [user])

  const fetchApkInfo = async () => {
    try {
      // Configuration de l'APK
      setApkUrl('/downloads/faso-ticket-gateway.apk')
      setApkVersion('1.0.0')
    } catch (error) {
      console.error('Erreur APK:', error)
    }
  }

  // ============================================================
  // GÉNÉRATION DE LA CLÉ
  // ============================================================

  const handleGenererCle = async () => {
    setError('')
    setSuccess('')
    setGenerating(true)

    try {
      // 1. Vérifier si l'organisateur a déjà une clé (pour Basique)
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

      // 2. Si Premium : désactiver toutes les anciennes clés
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

      // 3. Récupérer les informations de l'organisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('structure, nom_associe, plan_expire')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const nom = profile.nom_associe || profile.structure || 'Organisateur'
      const dateExpiration = profile.plan_expire ? new Date(profile.plan_expire) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      // 4. Appeler la fonction SQL pour générer la clé
      const { data: cle, error: cleError } = await supabase.rpc(
        'generer_cle_association',
        {
          p_organisateur_id: user.id,
          p_nom: nom,
          p_date_expiration: dateExpiration
        }
      )

      if (cleError) throw cleError

      // 5. Mettre à jour l'état
      setCleAssociation(cle)
      setCleExists(true)
      
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

  // ============================================================
  // GESTION DU GUIDE
  // ============================================================

  const startCountdown = () => {
    if (countdownActive) return
    
    setCountdown(5)
    setCountdownActive(true)
    setStepCompleted(false)
    
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current)
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current)
          setCountdownActive(false)
          setStepCompleted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const goToNextStep = () => {
    if (!stepCompleted && currentStep < steps.length - 1) {
      setError('Veuillez attendre la fin du compte à rebours')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      setStepCompleted(false)
      setCountdown(5)
      setError('')
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setStepCompleted(false)
      setCountdown(5)
      setError('')
    }
  }

  // ============================================================
  // GESTION DE LA CLÉ (VISUALISATION)
  // ============================================================

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
  // TÉLÉCHARGEMENT DE L'APK - TOUS PEUVENT TÉLÉCHARGER
  // ============================================================

  const handleDownloadApk = async () => {
    if (!responsibilityAccepted) {
      setError('❌ Vous devez accepter l\'engagement de responsabilité')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!cleExists) {
      setError('❌ Veuillez générer votre clé d\'association avant de télécharger')
      setTimeout(() => setError(''), 3000)
      return
    }

    setDownloading(true)
    setError('')

    try {
      // Journaliser le téléchargement
      await supabase
        .from('association_tokens')
        .update({ derniere_utilisation: new Date().toISOString() })
        .eq('token_cle', cleAssociation)

      // Télécharger l'APK
      const link = document.createElement('a')
      link.href = apkUrl
      link.download = `FASO-TICKET-Gateway-${apkVersion}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSuccess('✅ Téléchargement démarré !')
      setTimeout(() => setSuccess(''), 3000)

    } catch (error) {
      console.error('Erreur téléchargement:', error)
      setError('Erreur lors du téléchargement')
    } finally {
      setDownloading(false)
    }
  }

  // ============================================================
  // EFFET DE NETTOYAGE
  // ============================================================

  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
      }
    }
  }, [])

  // ============================================================
  // DÉMARRAGE DU COMPTE À REBOURS AU CHANGEMENT D'ÉTAPE
  // ============================================================

  useEffect(() => {
    if (!isLoading) {
      startCountdown()
    }
  }, [currentStep, isLoading])

  // ============================================================
  // RENDU
  // ============================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ===== EN-TÊTE ===== */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/organisateur/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour au dashboard
            </button>
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
            {planInfo.estPremium ? (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Génération illimitée
              </span>
            ) : (
              <span className="text-yellow-400 text-xs flex items-center gap-1">
                <Lock className="w-3 h-3" />
                1 clé maximum
              </span>
            )}
          </div>
        </div>

        {/* ===== TITRE ===== */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            🚀 Activation du <span className="text-yellow-400">Gateway SMS & Scanner</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Suivez ce guide pour activer et configurer votre application mobile
          </p>
        </div>

        {/* ===== BARRE DE PROGRESSION ===== */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                index <= currentStep ? 'bg-yellow-400' : 'bg-gray-700'
              }`} />
              {index < steps.length - 1 && (
                <div className="text-gray-500 text-xs">|</div>
              )}
            </div>
          ))}
        </div>

        {/* ===== ÉTAPE ACTUELLE ===== */}
        <div className="bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-800">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-yellow-400/10 p-3 rounded-xl">
              {steps[currentStep].icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Étape {currentStep + 1} sur {steps.length}
              </h2>
              <p className="text-yellow-400 font-medium">{steps[currentStep].title}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Clock className={`w-4 h-4 ${countdownActive ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`} />
              <span className={`text-sm font-bold ${countdownActive ? 'text-yellow-400' : 'text-gray-500'}`}>
                {countdownActive ? countdown : '✓'}
              </span>
            </div>
          </div>

          {/* Contenu de l'étape */}
          <div className="min-h-[300px]">
            {steps[currentStep].content}
          </div>

          {/* Message d'erreur/succès */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{success}</span>
            </div>
          )}

          {/* Boutons de navigation */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-800">
            <button
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={goToNextStep}
                disabled={!stepCompleted}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors ${
                  stepCompleted
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-black'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
                <span className="text-xs ml-2">
                  {countdownActive ? `(${countdown}s)` : '✓'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  document.getElementById('download-section')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors bg-yellow-400 hover:bg-yellow-300 text-black"
              >
                Télécharger l'APK
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ===== SECTION TÉLÉCHARGEMENT (DERNIÈRE ÉTAPE) ===== */}
        {currentStep === steps.length - 1 && (
          <div id="download-section" className="mt-8 bg-gray-900 rounded-2xl p-6 md:p-8 border border-yellow-400/30">
            <h3 className="text-xl font-bold text-white text-center mb-6">
              📲 Téléchargez votre application
            </h3>

            <div className="space-y-6">
              {/* ===== GÉNÉRATION DE LA CLÉ ===== */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-5 h-5 text-yellow-400" />
                  <p className="text-gray-300 font-medium">Votre clé d'association :</p>
                  {!planInfo.estPremium && cleExists && (
                    <span className="text-yellow-400 text-xs ml-auto">✅ Clé générée</span>
                  )}
                  {!planInfo.estPremium && !cleExists && (
                    <span className="text-gray-500 text-xs ml-auto">⏳ Non générée</span>
                  )}
                  {planInfo.estPremium && cleExists && (
                    <span className="text-green-400 text-xs ml-auto">✅ Clé active</span>
                  )}
                </div>

                {cleExists ? (
                  <div>
                    {showCle ? (
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <code className="flex-1 text-yellow-400 text-sm md:text-base font-mono break-all bg-black/50 px-3 py-2 rounded block w-full">
                          {cleAssociation}
                        </code>
                        <div className="flex gap-2">
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
                      <div className="flex flex-col sm:flex-row items-center gap-4">
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

                    {/* Bouton générer (Premium seulement) */}
                    {planInfo.estPremium && (
                      <div className="mt-3">
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
                        <p className="text-gray-500 text-xs mt-1">
                          ⭐ Premium : Génération illimitée - Les anciennes clés sont désactivées
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <Key className="w-10 h-10 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-400 text-sm">Aucune clé générée</p>
                    <button
                      onClick={handleGenererCle}
                      disabled={generating}
                      className={`mt-3 flex items-center gap-2 mx-auto px-6 py-2 rounded-lg transition-colors text-sm font-medium ${
                        generating
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
                      <p className="text-yellow-400 text-xs mt-2">
                        ⚠️ Plan Basique : 1 clé maximum
                      </p>
                    )}
                    {planInfo.estPremium && (
                      <p className="text-green-400 text-xs mt-2">
                        ⭐ Premium : Génération illimitée
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ===== ENGAGEMENT DE RESPONSABILITÉ ===== */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="responsibility"
                    checked={responsibilityAccepted}
                    onChange={(e) => setResponsibilityAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-yellow-400 cursor-pointer"
                  />
                  <label htmlFor="responsibility" className="text-gray-300 text-sm">
                    <span className="font-bold text-yellow-400">⚠️ Engagement de responsabilité :</span>
                    <br />
                    Je certifie avoir lu et compris les 4 étapes du guide. 
                    Je suis responsable de la configuration de mon téléphone et de la sécurité de ma clé d'association.
                    <br />
                    <span className="text-red-400 text-xs">
                      Je ne partagerai pas ma clé d'association avec des personnes non autorisées.
                    </span>
                  </label>
                </div>
              </div>

              {/* ===== BOUTON DE TÉLÉCHARGEMENT ===== */}
              <button
                onClick={handleDownloadApk}
                disabled={downloading || !responsibilityAccepted || !cleExists}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-[1.02] ${
                  downloading || !responsibilityAccepted || !cleExists
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg shadow-yellow-400/25'
                }`}
              >
                {downloading ? (
                  <>
                    <Loader className="w-6 h-6 animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    Télécharger l'APK ({apkVersion})
                  </>
                )}
              </button>
              {!cleExists && (
                <p className="text-red-400 text-xs text-center">
                  ⚠️ Veuillez générer votre clé d'association avant de télécharger
                </p>
              )}
              {cleExists && !responsibilityAccepted && (
                <p className="text-yellow-400 text-xs text-center">
                  ⚠️ Veuillez accepter l'engagement de responsabilité
                </p>
              )}

              <p className="text-gray-500 text-xs text-center">
                Version {apkVersion} - Taille ~15 MB - Compatible Android 7.0+
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                <p className="text-yellow-400 text-sm font-medium">📱 Après téléchargement</p>
                <p className="text-gray-400 text-xs mt-1">
                  1. Ouvrez le fichier APK<br />
                  2. Installez l'application<br />
                  3. Lancez l'application et choisissez <strong>"Espace Organisateur"</strong><br />
                  4. Collez votre clé d'association
                </p>
              </div>
            </div>
          </div>
        )}
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
    </div>
  )
}

export default GuideInstallationOrganisateur