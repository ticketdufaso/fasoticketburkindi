package com.fasoticket.gateway.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log
import android.widget.Toast

/**
 * BroadcastReceiver pour intercepter les SMS entrants
 * Filtre uniquement les SMS Orange Money
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
        private const val ORANGE_MONEY_SENDER = "222" // Orange Money expéditeur
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            Log.d(TAG, "📩 SMS reçu")

            // Récupérer les messages SMS
            val messages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                Telephony.Sms.Intents.getMessagesFromIntent(intent)
            } else {
                @Suppress("DEPRECATION")
                val pdus = intent.getSerializableExtra("pdus") as? Array<Any>
                pdus?.mapNotNull {
                    SmsMessage.createFromPdu(it as ByteArray)
                }?.toTypedArray() ?: emptyArray()
            }

            for (message in messages) {
                val sender = message.displayOriginatingAddress
                val body = message.messageBody ?: ""

                Log.d(TAG, "📨 Expéditeur: $sender")
                Log.d(TAG, "📝 Contenu: $body")

                // ✅ Vérifier si c'est un SMS Orange Money
                if (sender == ORANGE_MONEY_SENDER || sender.startsWith("222")) {
                    Log.d(TAG, "✅ SMS Orange Money détecté !")
                    processOrangeMoneySms(context, sender, body)
                } else {
                    Log.d(TAG, "⏭️ SMS ignoré (expéditeur non autorisé)")
                }
            }
        }
    }

    /**
     * Traite un SMS Orange Money
     * Extrait le montant, l'ID de transaction et le numéro de dépôt
     */
    private fun processOrangeMoneySms(context: Context, sender: String, body: String) {
        try {
            Log.d(TAG, "🔄 Traitement du SMS Orange Money...")

            // TODO: Extraire les informations du SMS
            // Format attendu : "Transaction de 1000 FCFA vers 70123456. ID: PP123456.1234.12345678"
            // À adapter selon le format réel des SMS Orange Money

            val montant = extractMontant(body)
            val transactionId = extractTransactionId(body)
            val numeroDepot = extractNumeroDepot(body)

            Log.d(TAG, "💰 Montant: $montant")
            Log.d(TAG, "🆔 Transaction ID: $transactionId")
            Log.d(TAG, "📱 Numéro dépôt: $numeroDepot")

            if (montant > 0 && transactionId.isNotBlank()) {
                // TODO: Envoyer les données au serveur Supabase
                // Enregistrer dans la table paiements_clients
                Log.d(TAG, "✅ Paiement enregistré avec succès !")

                // Notification
                Toast.makeText(context, "✅ Paiement de $montant FCFA reçu !", Toast.LENGTH_LONG).show()
            } else {
                Log.w(TAG, "⚠️ Impossible d'extraire les données du SMS")
                Toast.makeText(context, "⚠️ SMS non reconnu", Toast.LENGTH_SHORT).show()
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Erreur lors du traitement du SMS: ${e.message}")
        }
    }

    /**
     * Extrait le montant du SMS
     */
    private fun extractMontant(body: String): Int {
        // Recherche du montant (ex: "1000 FCFA" ou "1000FCFA")
        val regex = Regex("(\\d+)\\s*FCFA")
        val match = regex.find(body)
        return match?.groupValues?.get(1)?.toIntOrNull() ?: 0
    }

    /**
     * Extrait l'ID de transaction du SMS
     */
    private fun extractTransactionId(body: String): String {
        // Recherche de l'ID (ex: "PP123456.1234.12345678")
        val regex = Regex("PP\\d+\\.\\d+\\.\\d+")
        val match = regex.find(body)
        return match?.value ?: ""
    }

    /**
     * Extrait le numéro de dépôt du SMS
     */
    private fun extractNumeroDepot(body: String): String {
        // Recherche du numéro (ex: "vers 70123456")
        val regex = Regex("vers\\s*(\\d{8})")
        val match = regex.find(body)
        return match?.groupValues?.get(1) ?: ""
    }
}