/**
 * Ticket Généré - Version horizontale avec affiche en fond
 * Règles NASA 1-10
 * CORRECTIONS FINALES V10 :
 * - ✅ Utilisation de RPC marquer_telechargement pour contourner RLS
 * - ✅ est_telecharger mis à jour correctement en base
 * - ✅ Vérification de est_scanner avant téléchargement
 * - ✅ Tous les textes en BLANC ou JAUNE en GRAS
 * - ✅ Suppression des affichages pour l'organisateur
 * - ✅ PNG avec fond TRANSPARENT
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { 
  Download, Home, Ticket, Calendar, MapPin, User, Phone, 
  CreditCard, Loader, CheckCircle, AlertCircle, Crown, 
  Sparkles, Building2, Sofa, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TicketGenere = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const ticketRef = useRef(null);
  
  // États
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ticketData, setTicketData] = useState(null);
  const [evenement, setEvenement] = useState(null);
  const [typeTicket, setTypeTicket] = useState(null);
  const [organisateur, setOrganisateur] = useState(null);
  const [estScanne, setEstScanne] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [estTelecharger, setEstTelecharger] = useState(false);
  const [isOrganisateurView, setIsOrganisateurView] = useState(false);
  const [isDownloadingFromWhatsApp, setIsDownloadingFromWhatsApp] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const getSiteUrl = () => window.location.origin;

  const formatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'EEEE dd MMMM yyyy', { locale: fr });
    } catch {
      return '';
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'HH:mm', { locale: fr });
    } catch {
      return '';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return '';
    }
  };

  const getIconeForCategorie = (categorie) => {
    const cat = categorie?.toLowerCase() || '';
    switch(cat) {
      case 'vip': return <Crown className="h-4 w-4" />;
      case 'vvip': return <Sparkles className="h-4 w-4" />;
      case 'stand': return <Building2 className="h-4 w-4" />;
      case 'salon': return <Sofa className="h-4 w-4" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  // ============================================================
  // VÉRIFIER SI LE TÉLÉCHARGEMENT VIENT DE WHATSAPP (?download=true)
  // ============================================================
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const downloadParam = params.get('download');
    
    if (downloadParam === 'true') {
      console.log('📥 Téléchargement depuis WhatsApp détecté');
      setIsDownloadingFromWhatsApp(true);
    }
  }, [location]);

  // ============================================================
  // TÉLÉCHARGEMENT - AVEC RPC marquer_telechargement
  // ============================================================

  const handleDownload = async () => {
    // ✅ L'organisateur ne peut PAS télécharger
    if (userRole === 'organisateur') {
      setError('⚠️ Les organisateurs ne peuvent pas télécharger les tickets.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // ✅ L'admin ne peut PAS télécharger
    if (userRole === 'admin') {
      setError('⚠️ Les administrateurs ne peuvent pas télécharger les tickets.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // ✅ Vérifier si déjà scanné
    if (estScanne) {
      setError('⚠️ Ce ticket a déjà été scanné et n\'est plus valide.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!ticketRef.current) {
      setError('❌ Référence du ticket non trouvée.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setDownloading(true);
    setError('');

    try {
      console.log('📥 Début du téléchargement du ticket:', id);
      
      // ============================================================
      // ✅ 1. CAPTURE AVEC FOND TRANSPARENT
      // ============================================================
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        allowTaint: true,
        useClone: true,
        width: 850,
        height: 530
      });
      
      // 2. Télécharger le fichier
      const link = document.createElement('a');
      link.download = `ticket-${id}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Fichier téléchargé avec succès (fond transparent)');

      // ============================================================
      // ✅ 3. APPEL RPC POUR MARQUER LE TÉLÉCHARGEMENT (contourne RLS)
      // ============================================================
      
      console.log('📝 Appel RPC marquer_telechargement pour le ticket:', id);
      
      // Récupérer le numéro WhatsApp du client depuis le ticket
      const whatsapp = ticketData?.client_whatsapp;
      
      if (!whatsapp) {
        console.warn('⚠️ Numéro WhatsApp non trouvé, impossible de marquer le téléchargement');
        setError('⚠️ Le téléchargement a réussi mais le statut n\'a pas été enregistré.');
        setTimeout(() => setError(''), 3000);
        setDownloading(false);
        return;
      }
      
      const { data: result, error: rpcError } = await supabase.rpc('marquer_telechargement', {
        p_ticket_id: id,
        p_whatsapp: whatsapp
      });
      
      if (rpcError) {
        console.error('❌ Erreur RPC marquer_telechargement:', rpcError);
        setError('⚠️ Le téléchargement a réussi mais le statut n\'a pas été enregistré.');
        setTimeout(() => setError(''), 3000);
      } else if (result && result.success) {
        console.log('✅ RPC marquer_telechargement réussie:', result);
        setEstTelecharger(true);
        setSuccess('✅ Ticket téléchargé avec succès !');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        console.warn('⚠️ RPC marquer_telechargement a échoué:', result);
        setError('⚠️ Le téléchargement a réussi mais le statut n\'a pas été enregistré.');
        setTimeout(() => setError(''), 3000);
      }

    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      setError('❌ Erreur lors du téléchargement: ' + (error.message || 'Veuillez réessayer'));
      setTimeout(() => setError(''), 3000);
    } finally {
      setDownloading(false);
      setIsDownloadingFromWhatsApp(false);
    }
  };

  // ============================================================
  // TÉLÉCHARGEMENT AUTOMATIQUE DEPUIS WHATSAPP
  // ============================================================

  useEffect(() => {
    if (isDownloadingFromWhatsApp && !loading && !estScanne && userRole === 'client') {
      console.log('📥 Téléchargement automatique depuis WhatsApp déclenché');
      setTimeout(() => {
        handleDownload();
      }, 1500);
    }
  }, [isDownloadingFromWhatsApp, loading, estScanne, userRole]);

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        setLoading(true);
        setError('');

        console.log('🔍 Chargement du ticket:', id);

        const { data: vente, error: venteError } = await supabase
          .from('ventes')
          .select('*')
          .eq('id', id)
          .single();

        if (venteError || !vente) {
          console.error('❌ Ticket non trouvé:', venteError);
          setError('Ticket non trouvé');
          setLoading(false);
          return;
        }

        console.log('📦 Données du ticket:', vente);
        console.log('📊 est_telecharger actuel:', vente.est_telecharger);
        console.log('📊 est_scanner actuel:', vente.est_scanner);

        setTicketData(vente);
        setEstScanne(vente.est_scanner || false);
        setEstTelecharger(vente.est_telecharger || false);

        if (vente.evenement_id) {
          const { data: event, error: eventError } = await supabase
            .from('evenements')
            .select('*, organisateur:profiles(*)')
            .eq('id', vente.evenement_id)
            .single();

          if (!eventError && event) {
            setEvenement(event);
            if (event.organisateur) {
              setOrganisateur(event.organisateur);
            }
          }
        }

        if (vente.type_ticket_id) {
          const { data: type, error: typeError } = await supabase
            .from('types_tickets')
            .select('*')
            .eq('id', vente.type_ticket_id)
            .single();

          if (!typeError && type) {
            setTypeTicket(type);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setUserRole(profile.role);
            console.log('👤 Rôle utilisateur:', profile.role);
            
            if (profile.role === 'organisateur') {
              setIsOrganisateurView(true);
            }
          }
        } else {
          setUserRole('client');
          setIsClient(true);
          console.log('👤 Utilisateur non connecté (client)');
        }

        const params = new URLSearchParams(location.search);
        if (params.get('download') === 'true') {
          setIsDownloadingFromWhatsApp(true);
        }

      } catch (error) {
        console.error('❌ Erreur chargement:', error);
        setError('Erreur lors du chargement du ticket');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTicketData();
    }
  }, [id, location.search]);

  // ============================================================
  // VÉRIFICATION : ADMIN BLOQUÉ
  // ============================================================

  if (!loading && userRole === 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-red-500/30 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">⛔ Accès refusé</h2>
          <p className="text-gray-400">Les administrateurs n'ont pas accès aux tickets.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const getStatusInfo = () => {
    if (estScanne) {
      return { text: 'SCANNÉ', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' };
    }
    if (estTelecharger && userRole === 'client') {
      return { text: 'TÉLÉCHARGÉ', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' };
    }
    return { text: 'VALIDE', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' };
  };

  const status = getStatusInfo();
  const qrValue = `${getSiteUrl()}/verify/${id}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Chargement du ticket...</p>
        </div>
      </div>
    );
  }

  if (error && !ticketData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-800 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Ticket non trouvé</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // Si le ticket est scanné, afficher un message
  if (estScanne) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-red-500/30 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Ticket déjà scanné</h2>
          <p className="text-gray-400">Ce ticket a déjà été utilisé et n'est plus valide.</p>
          {ticketData?.date_scannage && (
            <p className="text-gray-500 text-xs mt-2">
              Scanné le : {formatDateTime(ticketData.date_scannage)}
            </p>
          )}
          <button
            onClick={() => navigate('/')}
            className="mt-6 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const isButtonDisabled = 
    downloading || 
    estScanne || 
    userRole === 'organisateur' ||
    userRole === 'admin';

  return (
    <div className="min-h-screen bg-black py-4 md:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">
              {isOrganisateurView ? 'Ticket' : 'Votre Ticket'}
            </h1>
            <p className="text-gray-500 text-xs">{typeTicket?.nom || 'Ticket'}</p>
          </div>
          <div className="w-20" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg mb-3 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-2 rounded-lg mb-3 flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ===== TICKET ===== */}
        <div 
          ref={ticketRef}
          className="relative rounded-xl overflow-hidden shadow-2xl w-full"
          style={{ 
            maxWidth: '800px', 
            marginLeft: 'auto', 
            marginRight: 'auto',
            aspectRatio: '16/9',
            minHeight: '280px',
            borderRadius: '16px'
          }}
        >
          {/* Fond : affiche de l'événement floutée */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: evenement?.affiche_url ? `url(${evenement.affiche_url})` : 'none',
              filter: 'blur(8px) brightness(0.3)',
              transform: 'scale(1.05)'
            }}
          />
          
          {/* Overlay noir semi-transparent */}
          <div className="absolute inset-0 bg-black/50" />
          
          <div className="relative z-10 p-3 md:p-4 h-full flex flex-col">
            
            {/* ===== EN-TÊTE ===== */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div 
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 text-white"
                  style={{ 
                    backgroundColor: typeTicket?.couleur || '#FFD700', 
                    color: '#000' 
                  }}
                >
                  {getIconeForCategorie(typeTicket?.categorie)}
                  <span>{typeTicket?.nom || 'TICKET'}</span>
                </div>
                {estTelecharger && userRole === 'client' && (
                  <div className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/30 text-yellow-400 border border-yellow-500/30">
                    TÉLÉCHARGÉ
                  </div>
                )}
              </div>
              <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${status.bgColor} ${status.color} border ${status.borderColor}`}>
                {status.text}
              </div>
            </div>

            {/* ===== CORPS ===== */}
            <div className="flex flex-1 gap-3 min-h-0">
              
              {/* PARTIE GAUCHE */}
              <div className="w-3/5 flex flex-col bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <h2 className="text-yellow-400 font-bold text-sm md:text-base lg:text-lg drop-shadow-lg">
                  {evenement?.nom || 'Événement'}
                </h2>
                
                <div className="space-y-1 mt-1 text-white font-bold text-xs md:text-sm drop-shadow-lg">
                  {evenement?.date && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-400 text-sm">📅</span>
                      <span className="text-white font-bold text-xs md:text-sm">
                        {formatDate(evenement.date)} à {formatTime(evenement.date)}
                      </span>
                    </div>
                  )}
                  {evenement?.lieu && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                      <span className="text-white font-bold text-xs md:text-sm">
                        {evenement.lieu}
                      </span>
                    </div>
                  )}
                  {evenement?.infos_lieu && (
                    <div className="text-yellow-400 text-[10px] md:text-xs font-bold mt-0.5 drop-shadow-lg">
                      ℹ️ {evenement.infos_lieu}
                    </div>
                  )}
                </div>

                {/* QR CODE */}
                <div className="mt-auto pt-2 flex items-center justify-between border-t border-white/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-yellow-400 font-bold text-[8px] flex items-center gap-1 drop-shadow-lg">
                      <CreditCard className="h-2.5 w-2.5" /> QR CODE
                    </p>
                    <p className="text-white font-bold text-[8px] font-mono break-all drop-shadow-lg">
                      {id}
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded-xl flex-shrink-0 ml-3 shadow-lg">
                    <QRCodeSVG 
                      value={qrValue}
                      size={90}
                      level="H"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>
                </div>
              </div>

              {/* PARTIE DROITE */}
              <div className="w-2/5 flex flex-col gap-2">
                {/* Image du ticket */}
                <div className="flex-1 bg-black/40 backdrop-blur-sm rounded-xl p-2 border border-white/10 flex items-center justify-center min-h-[80px]">
                  {typeTicket?.image_url && !imageError ? (
                    <img 
                      src={typeTicket.image_url} 
                      alt={typeTicket.nom || 'Ticket'}
                      className="w-full h-full object-contain max-h-[100px]"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/60">
                      <Ticket className="h-8 w-8 text-yellow-400" />
                      <span className="text-[8px] text-white font-bold mt-1">Image du ticket</span>
                    </div>
                  )}
                </div>

                {/* Infos acheteur */}
                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {ticketData?.client_nom && (
                      <div className="col-span-2">
                        <p className="text-yellow-400 font-bold text-[8px] drop-shadow-lg">ACHETEUR</p>
                        <p className="text-white font-bold text-xs break-words drop-shadow-lg">
                          {ticketData.client_nom}
                        </p>
                      </div>
                    )}
                    {ticketData?.client_whatsapp && (
                      <div>
                        <p className="text-yellow-400 font-bold text-[8px] drop-shadow-lg">WHATSAPP</p>
                        <p className="text-white font-bold text-[10px] drop-shadow-lg">
                          {ticketData.client_whatsapp}
                        </p>
                      </div>
                    )}
                    {ticketData?.montant && (
                      <div className="text-right">
                        <p className="text-yellow-400 font-bold text-[8px] drop-shadow-lg">MONTANT</p>
                        <p className="text-yellow-400 font-bold text-xs drop-shadow-lg">
                          {ticketData.montant.toLocaleString()} FCFA
                        </p>
                      </div>
                    )}
                    {ticketData?.created_at && (
                      <div className="col-span-2">
                        <p className="text-yellow-400 font-bold text-[8px] drop-shadow-lg">DATE D'ACHAT</p>
                        <p className="text-white font-bold text-[10px] drop-shadow-lg">
                          {formatDateTime(ticketData.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-1.5 pt-1 border-t border-white/10 text-center">
              <p className="text-yellow-400 font-bold text-[10px] md:text-xs drop-shadow-lg">
                FASO TICKET - Billetterie sécurisée
              </p>
              <p className="text-white/70 font-bold text-[7px] drop-shadow-lg">
                Présentez ce ticket à l'entrée
              </p>
            </div>
          </div>
        </div>

        {/* ===== BOUTON TÉLÉCHARGEMENT - UNIQUEMENT POUR LE CLIENT ===== */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          {userRole === 'client' ? (
            <button
              onClick={handleDownload}
              disabled={isButtonDisabled || downloading}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all text-sm ${
                isButtonDisabled || downloading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-black'
              }`}
            >
              {downloading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Téléchargement...
                </>
              ) : estScanne ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Ticket scanné
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Télécharger le ticket
                </>
              )}
            </button>
          ) : isOrganisateurView ? (
            null
          ) : null}
        </div>

        {userRole === 'client' && estScanne && (
          <p className="text-red-400 text-xs text-center mt-3">
            ⚠️ Ce ticket a déjà été scanné et n'est plus valide.
          </p>
        )}
      </div>
    </div>
  );
};

export default TicketGenere;