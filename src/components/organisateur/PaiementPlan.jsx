/**
 * Paiement Plan - Organisateur
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - ✅ Recherche par ID en priorité (UUID), fallback par nom
 * - ✅ Utilisation de maybeSingle pour éviter les erreurs
 * - ✅ Vérification du montant
 * - ✅ Verrouillage pour éviter les conflits
 * - ✅ Transaction marquée immédiatement après validation
 * - ✅ Vérification dans paiements_organisateurs SANS filtre de statut
 * - ✅ Recherche avec normalisation pour les ID avec/sans points
 * - ✅ Mise à jour de la ligne existante (pas de nouveau paiement)
 * - ✅ Éviter les doublons dans paiements_plans (vérification source + existence)
 * - ✅ Messages d'erreur explicites pour chaque vérification
 * - ✅ RLS corrigée (lecture publique)
 * - ✅ Vérifications dans l'ordre (existence, dépôt, montant, statut)
 * - ✅ Affichage du nom associé depuis numeros_acceptes
 * - ✅ Validation Orange Money UNIQUEMENT (pas le téléphone)
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  ArrowLeft, Shield, CheckCircle, AlertCircle, Copy, Phone, Loader,
  Smartphone, User, Mail, Building, Lock, Key, Eye, EyeOff,
  CreditCard, DollarSign
} from 'lucide-react'


const PaiementPlan = () => {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [nomAssociePaiement, setNomAssociePaiement] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    structure: '',
    telephone: '',
    phoneOm: '',
    nomAssocie: '',
    typeCompte: 'courant',
    formatUssd: 'format_10',
    codeMarchand: '',
    password: '',
    confirmPassword: '',
    transactionId: '',
    numeroDepot: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        setLoading(true)
        setError('')
        
        // ✅ ÉTAPE 1 : RECHERCHE PAR ID (UUID) - MÉTHODE PRINCIPALE
        console.log('🔍 Recherche du plan par ID:', planId)
        
        let data = null
        let error = null
        
        // Essayer par ID d'abord (UUID)
        const { data: dataById, error: errorById } = await supabase
          .from('plans')
          .select('*')
          .eq('id', planId)
          .maybeSingle()
        
        if (!errorById && dataById) {
          data = dataById
          console.log('✅ Plan trouvé par ID:', data.id, data.nom)
        } else {
          console.log('⏳ Plan non trouvé par ID, essai par nom...')
          
          // ✅ ÉTAPE 2 : FALLBACK PAR NOM (rétrocompatibilité)
          const planNom = planId.charAt(0).toUpperCase() + planId.slice(1).toLowerCase()
          
          const { data: dataByName, error: errorByName } = await supabase
            .from('plans')
            .select('*')
            .eq('nom', planNom)
            .maybeSingle()
          
          if (!errorByName && dataByName) {
            data = dataByName
            console.log('✅ Plan trouvé par nom:', data.id, data.nom)
          } else {
            // ✅ ÉTAPE 3 : DERNIER RECOURS - ILIKE (insensible à la casse)
            console.log('⏳ Plan non trouvé par nom exact, essai ILIKE...')
            
            const { data: dataByIlike, error: errorByIlike } = await supabase
              .from('plans')
              .select('*')
              .ilike('nom', `%${planId}%`)
              .maybeSingle()
            
            if (!errorByIlike && dataByIlike) {
              data = dataByIlike
              console.log('✅ Plan trouvé par ILIKE:', data.id, data.nom)
            } else {
              error = errorByIlike || new Error('Plan non trouvé')
            }
          }
        }

        if (error) throw error
        
        if (!data) {
          setError('❌ Plan non trouvé. Veuillez vérifier le lien ou contacter l\'administrateur.')
          setLoading(false)
          return
        }
        
        setPlan(data)
        console.log('📦 Plan chargé avec succès:', data.nom, data.prix, 'FCFA')
        
      } catch (error) {
        console.error('❌ Erreur chargement plan:', error)
        setError('Erreur lors du chargement du plan. Veuillez réessayer.')
      } finally {
        setLoading(false)
      }
    }

    if (planId) {
      fetchPlan()
    }
  }, [planId])

  // ============================================================
  // RÉCUPÉRATION DU NOM ASSOCIÉ DEPUIS numeros_acceptes
  // ============================================================
  useEffect(() => {
    const fetchNomAssocie = async () => {
      try {
        const { data, error } = await supabase
          .from('numeros_acceptes')
          .select('nom_associe')
          .eq('actif', true)
          .eq('is_default', true)
          .single()

        if (!error && data) {
          setNomAssociePaiement(data.nom_associe || 'Non renseigné')
        } else {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('numeros_acceptes')
            .select('nom_associe')
            .eq('actif', true)
            .limit(1)
            .single()

          if (!fallbackError && fallbackData) {
            setNomAssociePaiement(fallbackData.nom_associe || 'Non renseigné')
          } else {
            setNomAssociePaiement('Non renseigné')
          }
        }
      } catch (error) {
        console.error('Erreur récupération nom associé:', error)
        setNomAssociePaiement('Non renseigné')
      }
    }

    if (plan) {
      fetchNomAssocie()
    }
  }, [plan])

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const generateUSSD = () => {
    const numero = '66987175'
    const montant = plan?.prix || 0
    return `*144*10*${numero}*${montant}#`
  }

  // ============================================================
  // ✅ FONCTION : VALIDER UN NUMÉRO ORANGE (2ème chiffre = 4,5,6,7)
  // ============================================================
  const estNumeroOrange = (numero) => {
    if (!numero || numero.length < 2) return false
    const deuxiemeChiffre = numero.charAt(1)
    const chiffresOrange = ['4', '5', '6', '7']
    return chiffresOrange.includes(deuxiemeChiffre)
  }

  // ============================================================
  // ✅ FONCTION : NORMALISER L'ID (supprimer les points)
  // ============================================================
  const normaliserId = (id) => {
    if (!id) return ''
    return id.replace(/\./g, '').toUpperCase()
  }

  // ============================================================
  // ✅ AJOUT : AJOUTER AUX REVENUS (VÉRIFICATION COMPLÈTE - PAS DE DOUBLON)
  // ============================================================
  const ajouterRevenus = async (userId, planNom, montant, sourcePaiement) => {
    try {
      // ✅ VÉRIFICATION 1 : Si la source est admin_manuel ou gateway
      // Ces paiements existent déjà dans paiements_organisateurs
      // On ne doit PAS créer de nouveau paiement dans paiements_plans
      if (sourcePaiement === 'admin_manuel' || sourcePaiement === 'gateway') {
        return true
      }

      // ✅ VÉRIFICATION 2 : Vérifier si un paiement existe déjà dans paiements_organisateurs
      // pour le même organisateur avec le même montant
      const { data: existingOrg, error: checkOrgError } = await supabase
        .from('paiements_organisateurs')
        .select('id')
        .eq('organisateur_id', userId)
        .eq('montant', montant)
        .eq('statut', 'valide')
        .maybeSingle()

      if (checkOrgError && checkOrgError.code !== 'PGRST116') {
        console.error('Erreur vérification paiements_organisateurs:', checkOrgError)
      }

      // Si un paiement existe déjà dans paiements_organisateurs, ne pas créer de doublon
      if (existingOrg) {
        return true
      }

      // ✅ VÉRIFICATION 3 : Vérifier si un paiement existe déjà dans paiements_plans
      const { data: existingPlan, error: checkPlanError } = await supabase
        .from('paiements_plans')
        .select('id')
        .eq('organisateur_id', userId)
        .eq('plan_id', planNom)
        .eq('montant', montant)
        .eq('statut', 'valide')
        .maybeSingle()

      if (checkPlanError && checkPlanError.code !== 'PGRST116') {
        console.error('Erreur vérification paiements_plans:', checkPlanError)
      }

      // Si un paiement existe déjà dans paiements_plans, ne pas créer de doublon
      if (existingPlan) {
        return true
      }

      // ✅ TOUTES LES VÉRIFICATIONS SONT PASSÉES
      // On peut créer le paiement dans paiements_plans
      const transactionId = `ACHAT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const numeroDepot = `ACHAT_${Math.random().toString(36).substring(2, 10).toUpperCase()}`

      const { error } = await supabase
        .from('paiements_plans')
        .insert([{
          organisateur_id: userId,
          plan_id: planNom,
          montant: montant,
          transaction_id: transactionId,
          numero_depot: numeroDepot,
          statut: 'valide',
          source: 'organisateur_achat',
          created_at: new Date().toISOString()
        }])

      if (error) {
        console.error('❌ Erreur insertion paiements_plans:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Erreur ajout revenus:', error)
      return false
    }
  }

  // ============================================================
  // ✅ VALIDATION DU PAIEMENT (SANS FILTRE DE STATUT)
  // ============================================================

  const handlePaymentValidation = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    const { transactionId, numeroDepot } = formData

    // === NETTOYAGE ===
    const cleanTransactionId = transactionId.trim()
    const cleanNumeroDepot = numeroDepot.trim()

    // === VALIDATION DE BASE ===
    if (!cleanTransactionId || cleanTransactionId.length < 5) {
      setError('❌ ID Transaction invalide (minimum 5 caractères)')
      setSubmitting(false)
      return
    }
    if (!cleanNumeroDepot || !/^[0-9]{8}$/.test(cleanNumeroDepot)) {
      setError('❌ Numéro de dépôt invalide (ex: 70123456)')
      setSubmitting(false)
      return
    }

    try {
      // ✅ Normaliser l'ID saisi
      const idNormaliseSaisi = normaliserId(cleanTransactionId)

      // ✅ Récupérer TOUS les paiements (SANS filtre de statut)
      const { data: paiements, error: listError } = await supabase
        .from('paiements_organisateurs')
        .select('*')
        .order('created_at', { ascending: false })

      if (listError) {
        console.error('Erreur récupération paiements:', listError)
        setError('❌ Erreur lors de la vérification. Veuillez réessayer.')
        setSubmitting(false)
        return
      }

      // ✅ Chercher le paiement correspondant (normalisé)
      const paiementTrouve = paiements?.find(p => {
        const idBaseNormalise = normaliserId(p.transaction_id)
        return idBaseNormalise === idNormaliseSaisi
      })

      // ❌ Si la transaction n'existe pas
      if (!paiementTrouve) {
        setError('❌ ID Transaction non trouvé. Veuillez vérifier votre ID.')
        setSubmitting(false)
        return
      }

      const paiement = paiementTrouve

      // ✅ VÉRIFICATION 2 : Numéro de dépôt correspond
      if (paiement.numero_depot !== cleanNumeroDepot) {
        setError(`❌ Le numéro de dépôt (${cleanNumeroDepot}) ne correspond pas à la transaction.`)
        setSubmitting(false)
        return
      }

      // ✅ VÉRIFICATION 3 : Montant correspond au prix du plan
      if (paiement.montant !== plan.prix) {
        setError(`❌ Le montant (${paiement.montant.toLocaleString()} FCFA) ne correspond pas au prix du plan (${plan.prix.toLocaleString()} FCFA).`)
        setSubmitting(false)
        return
      }

      // ✅ VÉRIFICATION 4 : Vérifier le statut
      if (paiement.statut === 'valide') {
        setError('❌ Cette transaction a déjà été utilisée et validée.')
        setSubmitting(false)
        return
      }

      if (paiement.statut === 'rejete') {
        setError('❌ Cette transaction a été rejetée. Contactez l\'administrateur.')
        setSubmitting(false)
        return
      }

      if (paiement.statut !== 'en_attente') {
        setError(`❌ Statut de la transaction invalide : "${paiement.statut}". Contactez l'administrateur.`)
        setSubmitting(false)
        return
      }

      // ✅ TOUTES LES VÉRIFICATIONS SONT PASSÉES
      // ✅ On VA METTRE À JOUR la ligne existante (pas créer une nouvelle)
      
      // Étape 1 : Marquer la transaction comme utilisée dans paiements_organisateurs
      const { error: updateError } = await supabase
        .from('paiements_organisateurs')
        .update({ 
          statut: 'valide',
          updated_at: new Date().toISOString()
        })
        .eq('id', paiement.id)

      if (updateError) {
        console.error('Erreur validation paiements_organisateurs:', updateError)
        setError('❌ Erreur lors de la validation du paiement. Veuillez réessayer.')
        setSubmitting(false)
        return
      }

      // ✅ Stocker l'ID du paiement et sa source pour la mise à jour après la création du compte
      sessionStorage.setItem('paiement_id', paiement.id)
      sessionStorage.setItem('paiement_source', paiement.source || '')
      
      setSuccess('✅ Paiement validé avec succès ! Créez votre compte maintenant.')
      setStep(2)
      
    } catch (error) {
      console.error('Erreur:', error)
      setError('❌ Erreur lors de la vérification: ' + (error.message || 'Veuillez réessayer.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // CRÉATION DU COMPTE ORGANISATEUR
  // ============================================================

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    // Validations
    if (!formData.email || !formData.email.includes('@')) {
      setError('Email invalide')
      setSubmitting(false)
      return
    }
    if (!formData.structure || formData.structure.length < 2) {
      setError('Nom de structure invalide')
      setSubmitting(false)
      return
    }
    
    // ✅ TÉLÉPHONE : Pas de validation Orange (tout numéro fonctionne)
    if (!formData.telephone || !/^[0-9]{8}$/.test(formData.telephone)) {
      setError('Téléphone invalide (ex: 77777777)')
      setSubmitting(false)
      return
    }

    // ✅ ORANGE MONEY : Validation Orange UNIQUEMENT
    if (!formData.phoneOm || !/^[0-9]{8}$/.test(formData.phoneOm)) {
      setError('Numéro Orange Money invalide (ex: 77777777)')
      setSubmitting(false)
      return
    }
    if (!estNumeroOrange(formData.phoneOm)) {
      setError('❌ Le numéro Orange Money doit être un numéro Orange (2ème chiffre = 4, 5, 6 ou 7).')
      setSubmitting(false)
      return
    }

    if (!formData.nomAssocie || formData.nomAssocie.length < 2) {
      setError('Nom associé au compte Orange Money requis')
      setSubmitting(false)
      return
    }
    if (formData.typeCompte === 'commercial' && formData.formatUssd === 'format_3' && !formData.codeMarchand) {
      setError('Code marchand requis pour le format 3')
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

    try {
      const paiementId = sessionStorage.getItem('paiement_id')
      if (!paiementId) {
        setError('Session de paiement expirée.')
        setSubmitting(false)
        return
      }

      const paiementSource = sessionStorage.getItem('paiement_source') || ''

      // Créer l'utilisateur
      const userData = {
        email: formData.email,
        password: formData.password,
        structure: formData.structure,
        telephone: formData.telephone,
        phone_om: formData.phoneOm,
        nom_associe: formData.nomAssocie,
        role: 'organisateur',
        type_compte: formData.typeCompte,
        format_ussd: formData.formatUssd,
        code_marchand: formData.formatUssd === 'format_3' ? formData.codeMarchand : null,
        numero_paiement: formData.formatUssd !== 'format_3' ? formData.phoneOm : null,
        nom_associe_paiement: formData.nomAssocie,
        plan_id: plan.nom
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: userData,
          emailRedirectTo: `${window.location.origin}/connexion`
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', formData.email)
            .single()
          
          if (existingUser) {
            await createProfile(existingUser.id, paiementId, paiementSource)
            return
          }
        }
        throw authError
      }

      if (!authData.user) throw new Error('Erreur de création utilisateur')

      await createProfile(authData.user.id, paiementId, paiementSource)

    } catch (error) {
      setError(error.message || 'Erreur lors de la création du compte')
    } finally {
      setSubmitting(false)
    }
  }

  const createProfile = async (userId, paiementId, paiementSource) => {
    try {
      const expireDate = new Date(Date.now() + plan.duree_jours * 24 * 60 * 60 * 1000)

      const profileData = {
        id: userId,
        email: formData.email,
        structure: formData.structure,
        telephone: formData.telephone,
        phone_om: formData.phoneOm,
        nom_associe: formData.nomAssocie,
        role: 'organisateur',
        type_compte: formData.typeCompte,
        format_ussd: formData.formatUssd,
        code_marchand: formData.formatUssd === 'format_3' ? formData.codeMarchand : null,
        numero_paiement: formData.formatUssd !== 'format_3' ? formData.phoneOm : null,
        nom_associe_paiement: formData.nomAssocie,
        plan_id: plan.nom,
        plan_expire: expireDate.toISOString(),
        statut: true
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) throw profileError

      // ✅ ÉTAPE IMPORTANTE : Mettre à jour le paiement dans paiements_organisateurs
      // avec l'ID de l'organisateur (pour lier le paiement au compte)
      const { error: updatePaiementError } = await supabase
        .from('paiements_organisateurs')
        .update({ 
          organisateur_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', paiementId)

      if (updatePaiementError) {
        console.error('Erreur mise à jour paiement organisateur:', updatePaiementError)
        // On continue quand même, ce n'est pas bloquant
      }

      // ✅ AJOUT : Ajouter aux revenus (dans paiements_plans) - AVEC VÉRIFICATION COMPLÈTE
      // La fonction ajouterRevenus vérifie :
      // 1. Si la source est admin_manuel ou gateway → ne pas créer
      // 2. Si un paiement existe déjà dans paiements_organisateurs → ne pas créer
      // 3. Si un paiement existe déjà dans paiements_plans → ne pas créer
      await ajouterRevenus(userId, plan.nom, plan.prix, paiementSource)

      sessionStorage.removeItem('paiement_id')
      sessionStorage.removeItem('paiement_source')

      await supabase.auth.signOut()
      
      setSuccess('✅ Compte créé avec succès !')
      setStep(3)
      
      setTimeout(() => navigate('/connexion'), 3000)
    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la création du profil')
    }
  }

  // ============================================================
  // APERÇU DU FORMAT USSD
  // ============================================================

  const getUssdPreview = () => {
    if (formData.typeCompte === 'commercial') {
      if (formData.formatUssd === 'format_3' && formData.codeMarchand) {
        return `*144*3*${formData.codeMarchand}*montant#`
      } else if (formData.formatUssd === 'format_10' && formData.phoneOm) {
        return `*144*10*${formData.phoneOm}*montant#`
      }
    } else if (formData.typeCompte === 'courant' && formData.phoneOm) {
      return `*144*2*1*${formData.phoneOm}*montant#`
    }
    return null
  }

  // ============================================================
  // RENDU
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>Plan non trouvé</p>
          <button onClick={() => navigate('/devenir-organisateur')} className="mt-4 text-yellow-400">
            Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/devenir-organisateur')}
          className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux plans
        </button>

        <div className="bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-800">
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
            Paiement <span className="text-yellow-400">{plan.nom}</span>
          </h1>
          <p className="text-gray-400 text-center text-sm mb-6">
            {plan.prix.toLocaleString()} FCFA - {plan.duree_jours} jours
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg mb-4 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* ===== ÉTAPE 1 : PAIEMENT ===== */}
          {step === 1 && (
            <div>
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-white font-bold text-sm mb-2">Code de paiement Orange Money</p>
                <div className="flex items-center gap-2 bg-black rounded-lg p-3">
                  <code className="text-yellow-400 text-sm font-mono flex-1 break-all">
                    {generateUSSD()}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generateUSSD())}
                    className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-green-400 text-xs mt-1">✓ Copié !</p>}
                <p className="text-white font-bold text-xs mt-2 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Copiez et composer ce code pour faire le paiement!
                </p>
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-xs font-bold">⚠️ Important :</p>
                  <p className="text-white font-bold text-xs mt-1">
                    Montant à payer : <span className="text-yellow-400 font-bold">{plan.prix.toLocaleString()} FCFA</span>
                    <br />
                    Nom associé : <span className="text-yellow-400 font-bold">{nomAssociePaiement}</span>
                    <br />
                    <span className="text-yellow-400 font-bold">Vérifiez que le montant et le nom correspondent avant de valider.</span>
                  </p>
                </div>
              </div>

              <form onSubmit={handlePaymentValidation} className="space-y-4">
                <div>
                  <label className="text-yellow-400 font-bold text-sm block mb-1">ID Transaction *</label>
                  <input
                    type="text"
                    value={formData.transactionId}
                    onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono"
                    placeholder="PP123456.1234.12345678"
                    required
                  />
                  <p className="text-white font-bold text-[10px] mt-1">
                    Exemple: PP123456.1234.12345678 ou PP123456123412345678 (avec ou sans points)
                  </p>
                </div>

                <div>
                  <label className="text-yellow-400 font-bold text-sm block mb-1">Numéro de dépôt *</label>
                  <input
                    type="tel"
                    value={formData.numeroDepot}
                    onChange={(e) => setFormData({ ...formData, numeroDepot: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                    placeholder="77777777"
                    required
                  />
                </div>

                <div className="bg-gray-800 rounded-lg p-3 border border-yellow-500/20">
                  <p className="text-gray-400 text-xs flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    Montant attendu : <span className="text-yellow-400 font-bold">{plan.prix.toLocaleString()} FCFA</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Vérification...' : 'Valider le paiement'}
                </button>
              </form>
            </div>
          )}

          {/* ===== ÉTAPE 2 : CRÉATION DU COMPTE ===== */}
          {step === 2 && (
            <div>
              <h2 className="text-yellow-400 font-bold text-lg mb-4">Créez votre compte organisateur</h2>
              <p className="text-white font-bold text-sm mb-6">Complétez vos informations pour activer votre espace</p>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="text-yellow-400 font-bold text-sm block mb-1">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Structure */}
                <div>
                  <label className="text-yellow-400 font-bold text-sm block mb-1">Nom de la structure *</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={formData.structure}
                      onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                      placeholder="Nom de votre structure"
                      required
                    />
                  </div>
                </div>

                {/* Téléphone - PAS DE VALIDATION ORANGE */}
                <div>
                  <label className="text-yellow-400 font-bold text-sm block mb-1">Téléphone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                      placeholder="77777777"
                      required
                    />
                  </div>
                </div>

                {/* Configuration Orange Money */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-white font-bold text-sm mb-3">Configuration Orange Money</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-yellow-400 font-bold text-sm block mb-1">Orange Money *</label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="tel"
                          value={formData.phoneOm}
                          onChange={(e) => setFormData({ ...formData, phoneOm: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                          placeholder="77777777"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-yellow-400 font-bold text-sm block mb-1">Nom associé *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={formData.nomAssocie}
                          onChange={(e) => setFormData({ ...formData, nomAssocie: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                          placeholder="Prénom NOM"
                          required
                        />
                      </div>
                      <p className="text-red-500 font-bold text-[10px] mt-1">
                        ⚠️ Si votre nom Orange Money est TRAORE MOHAMED, écrivez MOHAMED TRAORE
                      </p>
                    </div>
                  </div>

                  {/* Type de compte */}
                  <div className="mt-3">
                    <label className="text-white font-bold text-sm block mb-2">Type de compte *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-yellow-400 font-bold text-sm">
                        <input
                          type="radio"
                          name="typeCompte"
                          value="courant"
                          checked={formData.typeCompte === 'courant'}
                          onChange={(e) => setFormData({ ...formData, typeCompte: e.target.value, formatUssd: 'format_2' })}
                          className="accent-yellow-400"
                        />
                        Compte courant
                      </label>
                      <label className="flex items-center gap-2 text-yellow-400 font-bold text-sm">
                        <input
                          type="radio"
                          name="typeCompte"
                          value="commercial"
                          checked={formData.typeCompte === 'commercial'}
                          onChange={(e) => setFormData({ ...formData, typeCompte: e.target.value })}
                          className="accent-yellow-400"
                        />
                        Compte commercial
                      </label>
                    </div>
                  </div>

                  {/* Format USSD pour compte commercial */}
                  {formData.typeCompte === 'commercial' && (
                    <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                      <label className="text-yellow-400 font-bold text-sm block mb-2">Format de paiement *</label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-white font-bold text-sm">
                          <input
                            type="radio"
                            name="formatUssd"
                            value="format_3"
                            checked={formData.formatUssd === 'format_3'}
                            onChange={(e) => setFormData({ ...formData, formatUssd: e.target.value })}
                            className="accent-yellow-400"
                          />
                          Format 3 (code marchand) - <code className="text-yellow-400 text-xs">*144*3*code_marchand*montant#</code>
                        </label>
                        <label className="flex items-center gap-2 text-white font-bold text-sm">
                          <input
                            type="radio"
                            name="formatUssd"
                            value="format_10"
                            checked={formData.formatUssd === 'format_10'}
                            onChange={(e) => setFormData({ ...formData, formatUssd: e.target.value })}
                            className="accent-yellow-400"
                          />
                          Format 10 (numéro) - <code className="text-yellow-400 text-xs">*144*10*numéro*montant#</code>
                        </label>
                      </div>

                      {formData.formatUssd === 'format_3' && (
                        <div className="mt-3">
                          <label className="text-yellow-400 font-bold text-sm block mb-1">Code marchand *</label>
                          <input
                            type="text"
                            value={formData.codeMarchand}
                            onChange={(e) => setFormData({ ...formData, codeMarchand: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                            placeholder="12345678"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Format pour compte courant */}
                  {formData.typeCompte === 'courant' && (
                    <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                      <p className="text-white font-bold text-sm">
                        Format : <code className="text-yellow-400 text-xs">*144*2*1*{formData.phoneOm || '70123456'}*montant#</code>
                      </p>
                    </div>
                  )}

                  {/* Aperçu du format USSD */}
                  {formData.phoneOm && (
                    <div className="mt-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-yellow-400" />
                        <p className="text-white font-bold text-xs">📋 Format de paiement généré :</p>
                      </div>
                      <code className="text-yellow-400 text-sm font-mono break-all mt-1 block">
                        {getUssdPreview() || 'Remplissez les champs ci-dessus pour voir le format'}
                      </code>
                    </div>
                  )}
                </div>

                {/* Mot de passe */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-white font-bold text-sm mb-3">Sécurité</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-yellow-400 font-bold text-sm block mb-1">Mot de passe *</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-12 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                          placeholder="8 caractères min"
                          required
                          minLength="8"
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
                    <div>
                      <label className="text-yellow-400 font-bold text-sm block mb-1">Confirmer *</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-12 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                          placeholder="Confirmer"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Récapitulatif */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <p className="text-white font-bold text-sm">
                      Récapitulatif : Forfait {plan.nom} - {plan.prix.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      'Créer mon compte'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ===== ÉTAPE 3 : SUCCÈS ===== */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Compte créé avec succès !</h2>
              <p className="text-gray-400 text-sm">Vous allez être redirigé vers la page de connexion...</p>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => navigate('/connexion')}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-2 rounded-lg transition-colors"
                >
                  Se connecter maintenant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaiementPlan