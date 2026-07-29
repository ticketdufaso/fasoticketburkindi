/**
 * Détail Ticket - Boutique
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * CORRECTIONS :
 * - ✅ Vérification que le paiement appartient au bon organisateur
 * - ✅ Optimisation du chargement des types de tickets
 * - ✅ Fallback pour les images (évite les erreurs)
 * - ✅ Gestion des erreurs de chargement
 * - ✅ Stock vérifié en temps réel
 * - ✅ Nettoyage des ID (suppression des points, espaces, tirets)
 * - ✅ Recherche avec ou sans points
 * - ✅ Décrémentation du stock UNIQUEMENT dans la RPC (avec verrouillage)
 * - ✅ Le bouton "Retour" redirige vers le dashboard si l'utilisateur est organisateur
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  ArrowLeft, MapPin, Clock, Calendar, Ticket, User, Phone, 
  ShoppingBag, AlertCircle, CheckCircle, Loader, Tag,
  Percent, X, Eye, ImageOff
} from 'lucide-react'

const TicketDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState(null)
  const [organisateur, setOrganisateur] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    nom: '',
    whatsapp: '',
    transactionId: '',
    numeroDepot: '',
    codePromo: ''
  })
  const [codePromoApplied, setCodePromoApplied] = useState(false)
  const [codePromoData, setCodePromoData] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [stockError, setStockError] = useState(false)
  const [imageErrors, setImageErrors] = useState({})
  const [loadingTypes, setLoadingTypes] = useState(true)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        setLoadingTypes(true)
        
        // Récupérer le rôle de l'utilisateur connecté
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()
          if (profile) {
            setUserRole(profile.role)
            console.log('👤 Rôle utilisateur:', profile.role)
          }
        }

        const { data, error } = await supabase
          .from('evenements')
          .select(`
            *,
            organisateur:profiles(
              id,
              structure, 
              telephone, 
              email, 
              nom_associe, 
              phone_om, 
              type_compte, 
              format_ussd, 
              code_marchand
            ),
            types_tickets (id, nom, description, prix, stock, stock_initial, image_url, couleur, avantages)
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        setEvent(data)
        if (data.organisateur) {
          setOrganisateur(data.organisateur)
        }
        if (data.types_tickets && data.types_tickets.length > 0) {
          // Sélectionner le premier type disponible avec stock > 0
          const availableType = data.types_tickets.find(t => t.stock > 0)
          setSelectedType(availableType || data.types_tickets[0])
        }
        setLoadingTypes(false)
      } catch (error) {
        console.error('Erreur:', error)
        setLoadingTypes(false)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const generateUSSD = () => {
    if (!organisateur) return ''
    
    const org = organisateur
    const montant = selectedType?.prix || 0
    const finalMontant = codePromoApplied ? montant - (montant * (codePromoData?.valeur || 0) / 100) : montant
    
    if (org.type_compte === 'commercial') {
      if (org.format_ussd === 'format_3' && org.code_marchand) {
        return `*144*3*${org.code_marchand}*${Math.round(finalMontant)}#`
      } else if (org.format_ussd === 'format_10' && org.phone_om) {
        return `*144*10*${org.phone_om}*${Math.round(finalMontant)}#`
      }
    } else if (org.type_compte === 'courant' && org.phone_om) {
      return `*144*2*1*${org.phone_om}*${Math.round(finalMontant)}#`
    }
    return ''
  }

  // ============================================================
  // NETTOYAGE DES ID
  // ============================================================

  const cleanInput = (value) => {
    if (!value) return ''
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  }

  // ============================================================
  // APPLICATION DU CODE PROMO
  // ============================================================

  const applyCodePromo = async () => {
    setError('')
    setSuccess('')
    
    if (!formData.codePromo || formData.codePromo.length < 3) {
      setError('Veuillez entrer un code promo valide')
      return
    }

    if (!selectedType) {
      setError('Veuillez sélectionner un type de ticket')
      return
    }

    try {
      const { data, error } = await supabase
        .from('codes_promo')
        .select('*')
        .eq('code', formData.codePromo.toUpperCase())
        .eq('organisateur_id', event.organisateur_id)
        .eq('actif', true)
        .maybeSingle()

      if (error) {
        console.error('Erreur recherche code promo:', error)
        setError('Erreur lors de la vérification du code promo')
        return
      }

      if (!data) {
        setError('Code promo invalide ou expiré')
        return
      }

      const now = new Date()
      const dateDebut = new Date(data.date_debut)
      const dateFin = new Date(data.date_fin)

      if (now < dateDebut) {
        setError('Ce code promo n\'est pas encore actif')
        return
      }
      if (now > dateFin) {
        setError('Ce code promo a expiré')
        return
      }

      if (data.quantite_max > 0 && data.utilisations >= data.quantite_max) {
        setError('Ce code promo a atteint sa limite d\'utilisations')
        return
      }

      if (data.evenement_id && data.evenement_id !== id) {
        setError('Ce code promo n\'est pas valable pour cet événement')
        return
      }

      if (data.type_ticket_ids && data.type_ticket_ids.length > 0) {
        const isTypeAllowed = data.type_ticket_ids.includes(selectedType.id)
        
        if (!isTypeAllowed) {
          const { data: allowedTypes } = await supabase
            .from('types_tickets')
            .select('nom')
            .in('id', data.type_ticket_ids)
          
          const allowedNames = allowedTypes?.map(t => t.nom).join(', ') || 'types spécifiques'
          setError(`❌ Ce code promo n'est valable que pour : ${allowedNames}`)
          return
        }
      }

      setCodePromoData(data)
      setCodePromoApplied(true)
      setSuccess(`✅ Code promo appliqué ! ${data.type === 'pourcentage' ? data.valeur + '%' : data.valeur + ' FCFA'} de réduction`)
      
    } catch (error) {
      console.error('Erreur:', error)
      setError('Erreur lors de l\'application du code promo')
    }
  }

  const removeCodePromo = () => {
    setCodePromoApplied(false)
    setCodePromoData(null)
    setFormData({ ...formData, codePromo: '' })
    setSuccess('')
  }

  // ============================================================
  // RECHERCHE DU PAIEMENT - AVEC VÉRIFICATION DE L'ORGANISATEUR
  // ============================================================

  const findPaiement = async (cleanTransactionId, cleanNumeroDepot, organisateurId) => {
    // 1. Recherche exacte (avec points) ET vérification de l'organisateur
    let { data: paiement, error } = await supabase
      .from('paiements_clients')
      .select('*')
      .eq('transaction_id', cleanTransactionId)
      .eq('numero_depot', cleanNumeroDepot)
      .eq('organisateur_id', organisateurId)  // ← ✅ VÉRIFICATION DE L'ORGANISATEUR
      .maybeSingle()

    if (error) {
      console.error('Erreur recherche exacte:', error)
      return { paiement: null, error }
    }

    if (paiement) {
      return { paiement, error: null }
    }

    // 2. Recherche sans points AVEC vérification de l'organisateur
    const { data: paiements, error: listError } = await supabase
      .from('paiements_clients')
      .select('*')
      .eq('organisateur_id', organisateurId)  // ← ✅ VÉRIFICATION DE L'ORGANISATEUR
      .eq('statut', 'en_attente')

    if (listError) {
      console.error('Erreur liste paiements:', listError)
      return { paiement: null, error: listError }
    }

    if (paiements && paiements.length > 0) {
      const found = paiements.find(p => {
        const idBase = p.transaction_id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        return idBase === cleanTransactionId && p.numero_depot === cleanNumeroDepot
      })
      
      if (found) {
        return { paiement: found, error: null }
      }
    }

    return { paiement: null, error: null }
  }

  // ============================================================
  // GESTION DES ERREURS D'IMAGE
  // ============================================================

  const handleImageError = (typeId) => {
    setImageErrors(prev => ({ ...prev, [typeId]: true }))
  }

  // ============================================================
  // PAIEMENT - AVEC VÉRIFICATION DE L'ORGANISATEUR
  // ============================================================

  const handlePayment = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setStockError(false)
    setSubmitting(true)

    const cleanNom = formData.nom.trim()
    const cleanWhatsapp = formData.whatsapp.replace(/\s/g, '').trim()
    const cleanTransactionId = cleanInput(formData.transactionId)
    const cleanNumeroDepot = formData.numeroDepot.replace(/\s/g, '').trim()

    console.log('🔍 Recherche paiement avec vérification organisateur:', {
      transaction_id: cleanTransactionId,
      numero_depot: cleanNumeroDepot,
      organisateur_id: event.organisateur_id
    })

    if (!cleanNom || cleanNom.length < 2) {
      setError('Veuillez entrer votre nom complet')
      setSubmitting(false)
      return
    }
    if (!cleanWhatsapp || !/^[0-9]{8}$/.test(cleanWhatsapp)) {
      setError('Numéro WhatsApp invalide (ex: 70123456)')
      setSubmitting(false)
      return
    }
    if (!cleanTransactionId || cleanTransactionId.length < 5) {
      setError('ID Transaction invalide')
      setSubmitting(false)
      return
    }
    if (!cleanNumeroDepot || !/^[0-9]{8}$/.test(cleanNumeroDepot)) {
      setError('Numéro de dépôt invalide (ex: 70123456)')
      setSubmitting(false)
      return
    }

    if (!selectedType || !selectedType.id) {
      setError('❌ Aucun type de ticket sélectionné')
      setSubmitting(false)
      return
    }

    setFormData(prev => ({
      ...prev,
      nom: cleanNom,
      whatsapp: cleanWhatsapp,
      transactionId: cleanTransactionId,
      numeroDepot: cleanNumeroDepot
    }))

    try {
      // === 1. CALCUL DU PRIX FINAL ===
      let finalPrice = selectedType.prix
      let reduction = 0
      if (codePromoApplied && codePromoData) {
        if (codePromoData.type === 'pourcentage') {
          reduction = (finalPrice * codePromoData.valeur) / 100
          finalPrice = finalPrice - reduction
        } else {
          reduction = codePromoData.valeur
          finalPrice = finalPrice - reduction
        }
        finalPrice = Math.max(0, Math.round(finalPrice))
        reduction = Math.round(reduction)
      }

      console.log('✅ ÉTAPE 1 PASSÉE - Prix calculé:', finalPrice)

      // === 2. RECHERCHE DU PAIEMENT AVEC VÉRIFICATION DE L'ORGANISATEUR ===
      const { paiement, error: findError } = await findPaiement(
        cleanTransactionId,
        cleanNumeroDepot,
        event.organisateur_id  // ← ✅ VÉRIFICATION DE L'ORGANISATEUR
      )

      if (findError) {
        console.error('❌ Erreur findPaiement:', findError)
        setError('Erreur lors de la vérification de la transaction')
        setSubmitting(false)
        return
      }

      console.log('📦 Paiement trouvé:', paiement)
      console.log('📊 Statut du paiement:', paiement?.statut)
      console.log('✅ ÉTAPE 2 PASSÉE - Paiement trouvé avec vérification organisateur')

      if (!paiement) {
        setError('❌ Transaction non trouvée ou appartient à un autre organisateur. Vérifiez votre ID et numéro.')
        setSubmitting(false)
        return
      }

      if (paiement.statut !== 'en_attente') {
        console.log('❌ Statut invalide:', paiement.statut)
        setError(`❌ Cette transaction a déjà été utilisée (statut: ${paiement.statut}).`)
        setSubmitting(false)
        return
      }

      console.log('✅ ÉTAPE 3 PASSÉE - Statut en_attente')

      // === 3. VÉRIFIER LE MONTANT ===
      console.log('💰 Montant paiement:', paiement.montant)
      console.log('💰 Prix final:', finalPrice)

      if (paiement.montant !== finalPrice) {
        console.log('❌ Montant invalide:', paiement.montant, 'vs', finalPrice)
        setError(`❌ Le montant (${paiement.montant} FCFA) ne correspond pas au prix du ticket (${finalPrice} FCFA).`)
        setSubmitting(false)
        return
      }

      console.log('✅ ÉTAPE 4 PASSÉE - Montant OK')

      // === 4. APPEL RPC (LA VÉRIFICATION DU STOCK EST FAITE DANS LA RPC) ===
      console.log('🚀 Appel RPC acheter_ticket...')

      const qrCode = `PP${Date.now()}.${Math.random().toString(36).substring(2, 10)}`

      const { data: result, error: rpcError } = await supabase.rpc('acheter_ticket', {
        p_type_ticket_id: selectedType.id,
        p_evenement_id: event.id,
        p_client_nom: cleanNom,
        p_client_whatsapp: cleanWhatsapp,
        p_montant: finalPrice,
        p_transaction_id: paiement.transaction_id,
        p_numero_depot: cleanNumeroDepot,
        p_qr_code: qrCode,
        p_code_promo_id: codePromoData?.id || null,
        p_prix_original: selectedType.prix,
        p_reduction: reduction
      })

      console.log('📦 Résultat RPC:', { result, rpcError })

      if (rpcError) {
        console.error('❌ Erreur RPC:', rpcError)
        
        if (rpcError.message?.includes('stock_insuffisant')) {
          setStockError(true)
          setError('❌ Stock épuisé ! Un autre client a acheté le dernier ticket.')
        } else if (rpcError.message?.includes('transaction_deja_utilisee')) {
          setError('❌ Cette transaction a déjà été utilisée par un autre client.')
        } else if (rpcError.message?.includes('code_promo_inactif')) {
          setError('❌ Ce code promo n\'est plus actif.')
        } else if (rpcError.message?.includes('code_promo_limite_atteinte')) {
          setError('❌ Ce code promo a atteint sa limite d\'utilisations.')
        } else if (rpcError.message?.includes('PAYMENT_NOT_FOUND')) {
          setError('❌ Transaction non trouvée ou appartient à un autre organisateur.')
        } else {
          setError('Erreur lors du paiement: ' + (rpcError.message || 'Veuillez réessayer'))
        }
        setSubmitting(false)
        return
      }

      if (!result || !result.success) {
        console.error('❌ Résultat RPC échec:', result)
        setError(result?.message || 'Erreur lors du paiement')
        setSubmitting(false)
        return
      }

      console.log('✅ ÉTAPE 5 PASSÉE - RPC réussie')

      // === 5. METTRE À JOUR LE STATUT DU PAIEMENT ===
      const { error: updateError } = await supabase
        .from('paiements_clients')
        .update({ statut: 'valide', updated_at: new Date().toISOString() })
        .eq('id', paiement.id)

      if (updateError) {
        console.error('❌ Erreur mise à jour paiement:', updateError)
      }

      console.log('✅ ÉTAPE 6 PASSÉE - Paiement validé')

      setSuccess('✅ Paiement validé ! Votre ticket est prêt.')
      setStep(2)
      
      setTimeout(() => {
        navigate(`/ticket/${result.vente_id}`)
      }, 2000)
      
    } catch (error) {
      console.error('❌ Erreur inattendue dans handlePayment:', error)
      setError('Erreur inattendue: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-400 text-xl animate-spin">⏳</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Ticket className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Événement non trouvé</p>
        </div>
      </div>
    )
  }

  const getFinalPrice = () => {
    if (!selectedType) return 0
    let price = selectedType.prix
    if (codePromoApplied && codePromoData) {
      if (codePromoData.type === 'pourcentage') {
        price = price - (price * codePromoData.valeur / 100)
      } else {
        price = price - codePromoData.valeur
      }
      price = Math.max(0, Math.round(price))
    }
    return price
  }

  const ussdCode = generateUSSD()
  const showUssd = ussdCode && ussdCode.length > 5

  // ============================================================
  // DÉTERMINER SI ON AFFICHE LE FORMULAIRE D'ACHAT
  // ============================================================
  const showAchatForm = userRole !== 'organisateur' && userRole !== 'admin'

  // ============================================================
  // GESTION DU BOUTON RETOUR
  // ============================================================
  const handleBack = () => {
    if (userRole === 'organisateur') {
      navigate('/organisateur/dashboard')
    } else if (userRole === 'admin') {
      navigate('/admin/dashboard')
    } else {
      navigate('/boutique')
    }
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {userRole === 'organisateur' ? 'Retour au dashboard' : 
           userRole === 'admin' ? 'Retour au dashboard admin' : 
           'Retour à la boutique'}
        </button>

        <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
          <div className="relative">
            <img
              src={event.affiche_url || '/images/default-event.jpg'}
              alt={event.nom}
              className="w-full h-56 md:h-72 object-cover"
              onError={(e) => e.target.src = '/images/default-event.jpg'}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{event.nom}</h1>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span>{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span>{event.date ? new Date(event.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <MapPin className="w-4 h-4 text-yellow-400" />
                  <span>{event.lieu}</span>
                </div>
                {event.infos_lieu && (
                  <div className="text-yellow-400 text-xs mt-1 bg-gray-800 p-2 rounded-lg">
                    ℹ️ {event.infos_lieu}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Organisé par</p>
                <p className="text-white font-medium">{organisateur?.structure || 'Organisateur'}</p>
                {organisateur?.telephone && (
                  <p className="text-gray-400 text-sm">📞 {organisateur.telephone}</p>
                )}
              </div>
            </div>

            {event.description && (
              <p className="text-gray-300 text-sm mb-6 border-t border-gray-800 pt-4">{event.description}</p>
            )}

            {/* ============================================================
                AFFICHAGE DES TYPES DE TICKETS - AVEC FALLBACK IMAGES
                ============================================================ */}
            <div className="mb-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-yellow-400" />
                Types de tickets disponibles
                {loadingTypes && <Loader className="w-4 h-4 text-yellow-400 animate-spin ml-2" />}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {event.types_tickets?.map((type) => {
                  const isAvailable = type.stock > 0
                  const isSelected = selectedType?.id === type.id
                  const hasImageError = imageErrors[type.id]
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => isAvailable && setSelectedType(type)}
                      disabled={!isAvailable}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : isAvailable
                            ? 'border-gray-700 bg-gray-800 hover:border-gray-600 cursor-pointer'
                            : 'border-gray-800 opacity-50 cursor-not-allowed bg-gray-900'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{type.nom}</span>
                              {!isAvailable && (
                                <span className="text-red-400 text-xs">(Épuisé)</span>
                              )}
                              {type.stock <= 5 && isAvailable && (
                                <span className="text-orange-400 text-xs">(Plus que {type.stock})</span>
                              )}
                            </div>
                            {/* ===== IMAGE DU TICKET AVEC FALLBACK ===== */}
                            {type.image_url && type.image_url !== '/images/default-ticket.png' && !hasImageError ? (
                              <div className="mt-1 relative">
                                <img 
                                  src={type.image_url} 
                                  alt={type.nom}
                                  className="w-16 h-16 object-cover rounded-lg"
                                  onError={() => handleImageError(type.id)}
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="mt-1 w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                                <ImageOff className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <span className={`font-bold text-lg ${isSelected ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {type.prix?.toLocaleString()} FCFA
                          </span>
                        </div>
                        {type.description && (
                          <p className="text-gray-400 text-xs">{type.description}</p>
                        )}
                        {type.avantages && (
                          <p className="text-yellow-400 text-xs">✨ {type.avantages}</p>
                        )}
                        <p className="text-gray-500 text-xs">{type.stock} places disponibles</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ============================================================
                FORMULAIRE D'ACHAT - MASQUÉ POUR ORGANISATEUR ET ADMIN
                ============================================================ */}
            {showAchatForm ? (
              <>
                {step === 1 && selectedType && (
                  <div className="border-t border-gray-800 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-semibold">Acheter un ticket</h3>
                      {selectedType && (
                        <span className="text-yellow-400 font-bold">
                          {getFinalPrice().toLocaleString()} FCFA
                          {codePromoApplied && codePromoData && (
                            <span className="text-green-400 text-sm ml-2">
                              (-{codePromoData.type === 'pourcentage' ? codePromoData.valeur + '%' : codePromoData.valeur + ' FCFA'})
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="text-gray-400 text-sm block mb-1">Code promo (facultatif)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.codePromo}
                          onChange={(e) => setFormData({ ...formData, codePromo: e.target.value.toUpperCase() })}
                          disabled={codePromoApplied}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm uppercase disabled:opacity-50"
                          placeholder="PROMO2024"
                        />
                        {codePromoApplied ? (
                          <button
                            type="button"
                            onClick={removeCodePromo}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={applyCodePromo}
                            className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            Appliquer
                          </button>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handlePayment} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Nom complet *</label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={formData.nom}
                              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                              placeholder="Votre nom"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">WhatsApp *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="tel"
                              value={formData.whatsapp}
                              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                              placeholder="70123456"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-gray-300 text-sm mb-2">Paiement par Orange Money</p>
                        <div className="bg-black rounded-lg p-3 font-mono text-yellow-400 text-sm break-all">
                          {showUssd ? ussdCode : 'Configuration de paiement non disponible'}
                        </div>
                        {!showUssd && (
                          <p className="text-red-400 text-xs mt-2">
                            ⚠️ L'organisateur n'a pas configuré son paiement Orange Money.
                            <br />Contactez l'organisateur pour plus d'informations.
                          </p>
                        )}
                        <p className="text-gray-400 text-xs mt-2 flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <span className="text-yellow-400">⚠️</span>
                            Composez ce code sur votre téléphone Orange Money
                          </span>
                          {organisateur?.nom_associe && (
                            <span className="text-red-400">
                              ⚠️ Nom associé: {organisateur.nom_associe}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">ID Transaction *</label>
                          <input
                            type="text"
                            value={formData.transactionId}
                            onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono"
                            placeholder="PP111111.1111.11111111 ou PP111111111111111111"
                            required
                          />
                          <p className="text-gray-500 text-[10px] mt-1">Avec ou sans points</p>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Numéro de dépôt *</label>
                          <input
                            type="tel"
                            value={formData.numeroDepot}
                            onChange={(e) => setFormData({ ...formData, numeroDepot: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
                            placeholder="70123456"
                            required
                          />
                          <p className="text-gray-500 text-[10px] mt-1">8 chiffres sans espace</p>
                        </div>
                      </div>

                      {error && (
                        <div className={`${stockError ? 'bg-red-500/20' : 'bg-red-500/10'} border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-start gap-2`}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{error}</span>
                        </div>
                      )}
                      {success && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{success}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            Valider le paiement
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {step === 2 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Paiement validé !</h2>
                    <p className="text-gray-400 text-sm">Votre ticket est en cours de préparation...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Eye className="w-8 h-8 text-yellow-400" />
                  <h3 className="text-white font-semibold text-lg">Mode consultation</h3>
                </div>
                <p className="text-gray-400 text-sm">
                  Vous êtes connecté en tant que <strong className="text-yellow-400">{userRole}</strong>.
                  <br />
                  Les détails de l'événement sont affichés ci-dessus.
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  📌 Pour acheter un ticket, connectez-vous en tant que client.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TicketDetail