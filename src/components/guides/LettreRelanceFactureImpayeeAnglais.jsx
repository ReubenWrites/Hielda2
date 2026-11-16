import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

// /guides/lettre-relance-facture-impayee-anglais
// A French-language page. Search Console showed French speakers looking for
// an unpaid-invoice reminder letter *in English* ("lettre de relance facture
// impayée en anglais"), about a fifth of the site's impressions, landing on
// an English page that did not answer them. The letters are in English (that
// is what they need to send); everything around them is in French.
//
// Legal claims are kept narrow: which country's late-payment rules apply
// depends on the contract, and the page says so rather than assuming the UK
// Act covers a French supplier.

const TITLE = "Lettre de relance pour facture impayée en anglais : 3 modèles gratuits à copier"
const LEDE = "Un client britannique, irlandais ou américain tarde à payer ? Voici trois lettres de relance rédigées en anglais, du rappel courtois à la mise en demeure, avec leur traduction française, le vocabulaire à connaître et les usages de la correspondance commerciale anglaise."
const CANONICAL = "/guides/lettre-relance-facture-impayee-anglais"

const BANK_EN = `Bank details
Account name: [Company name]
IBAN: [IBAN]
BIC: [BIC]
Reference: [Invoice number]`

const BANK_FR = `Coordonnées bancaires
Titulaire du compte : [Nom de la société]
IBAN : [IBAN]
BIC : [BIC]
Référence : [Numéro de facture]`

const FIRST_EN = `Subject: Invoice [number]: payment reminder

Dear [Mr / Ms Surname],

I hope you are well. I am writing to remind you that invoice [number] for [amount], dated [invoice date], was due for payment on [due date]. According to our records, it has not yet been paid.

I attach a copy of the invoice for your convenience. If payment has already been made, please disregard this message.

If you have any questions about the invoice, or need anything further from us in order to process it, please let me know.

${BANK_EN}

Kind regards,
[Your name]
[Job title]
[Company name]`

const FIRST_FR = `Objet : Facture [numéro] : rappel de paiement

Madame, Monsieur [Nom],

J'espère que vous allez bien. Je me permets de vous rappeler que la facture [numéro] d'un montant de [montant], datée du [date de facture], était payable le [date d'échéance]. Sauf erreur de notre part, elle n'a pas encore été réglée.

Vous trouverez ci-joint une copie de la facture. Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.

Si vous avez des questions sur cette facture, ou s'il vous manque un élément pour la traiter, n'hésitez pas à me le faire savoir.

${BANK_FR}

Cordialement,
[Votre nom]
[Fonction]
[Société]`

const SECOND_EN = `Subject: Invoice [number]: second reminder, [X] days overdue

Dear [Mr / Ms Surname],

I refer to my email of [date] regarding invoice [number] for [amount], which was due on [due date]. The invoice is now [X] days overdue, and I have received neither payment nor a reply.

Please arrange payment by [date].

Please note that late payment interest and a fixed recovery charge apply to overdue invoices. I would prefer not to add these, and I will not do so if payment is received by the date above.

If there is a problem with the invoice or a reason for the delay, please let me know by return so that we can resolve it.

${BANK_EN}

Yours sincerely,
[Your name]
[Job title]
[Company name]`

const SECOND_FR = `Objet : Facture [numéro] : deuxième relance, [X] jours de retard

Madame, Monsieur [Nom],

Je fais suite à mon courriel du [date] concernant la facture [numéro] d'un montant de [montant], payable le [date d'échéance]. Cette facture accuse aujourd'hui [X] jours de retard et je n'ai reçu ni règlement ni réponse.

Je vous remercie de procéder au paiement avant le [date].

Je vous rappelle que des intérêts de retard et une indemnité forfaitaire de recouvrement s'appliquent aux factures impayées. Je préférerais ne pas les ajouter, et je ne le ferai pas si le paiement me parvient avant la date indiquée.

Si la facture pose un problème ou si le retard a une raison particulière, merci de me l'indiquer par retour afin que nous puissions y remédier.

${BANK_FR}

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.
[Votre nom]
[Fonction]
[Société]`

const FINAL_EN = `[Company name]
[Address]

[Date]

[Client company name]
[Client address]

By email and by post

Dear [Mr / Ms Surname],

FINAL DEMAND
Invoice [number] for [amount], due [due date]

Despite my reminders of [date] and [date], the invoice above remains unpaid. It is now [X] days overdue.

This letter is a formal demand for payment. The amount now due is:

Invoice [number]: [amount]
Late payment interest to [date]: [amount]
Fixed recovery charge: [amount]
Total due: [total]

Please pay the total due by [deadline date] to:

${BANK_EN}

If payment in full is not received by that date, we will take formal steps to recover the debt, including legal proceedings, without further notice. This would add costs and further interest to the amount you owe.

If you dispute this debt, please tell us in writing, with your reasons, by the same date.

Yours sincerely,

[Your name]
[Job title]
[Company name]`

const FINAL_FR = `[Société]
[Adresse]

[Date]

[Société cliente]
[Adresse du client]

Par courriel et par courrier

Madame, Monsieur [Nom],

MISE EN DEMEURE
Facture [numéro] d'un montant de [montant], payable le [date d'échéance]

Malgré mes relances du [date] et du [date], la facture ci-dessus demeure impayée. Elle accuse aujourd'hui [X] jours de retard.

La présente lettre vaut mise en demeure de payer. Le montant dû à ce jour s'établit comme suit :

Facture [numéro] : [montant]
Intérêts de retard au [date] : [montant]
Indemnité forfaitaire de recouvrement : [montant]
Total dû : [total]

Je vous demande de régler ce total avant le [date limite] sur le compte suivant :

${BANK_FR}

À défaut de paiement intégral à cette date, nous engagerons sans autre avis les démarches nécessaires au recouvrement de la créance, y compris une action en justice. Des frais et des intérêts supplémentaires s'ajouteraient alors à la somme due.

Si vous contestez cette créance, merci de nous en indiquer les raisons par écrit avant la même date.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

[Votre nom]
[Fonction]
[Société]`

const VOCAB = [
  ["une facture", "an invoice"],
  ["une facture impayée", "an unpaid invoice, an overdue invoice"],
  ["une relance", "a reminder, a payment reminder (familier : a chaser)"],
  ["relancer un client", "to chase a client, to send a reminder"],
  ["la date d'échéance", "the due date"],
  ["un retard de paiement", "late payment"],
  ["[X] jours de retard", "[X] days overdue (US : past due)"],
  ["les pénalités de retard", "late payment interest"],
  ["l'indemnité forfaitaire de recouvrement", "the fixed recovery charge, the fixed sum"],
  ["une mise en demeure", "a final demand, a formal demand"],
  ["la lettre avant procès", "a letter before action, a letter before claim"],
  ["un virement", "a bank transfer"],
  ["les coordonnées bancaires, le RIB", "bank details"],
  ["le règlement", "payment, settlement"],
  ["un acompte", "a deposit, a part payment"],
  ["un avoir", "a credit note"],
  ["un bon de commande", "a purchase order (PO)"],
  ["le service comptabilité", "the accounts department, accounts payable"],
  ["sauf erreur de notre part", "according to our records"],
  ["dans les meilleurs délais", "promptly, as soon as possible"],
]

const FAQS = [
  { q: "Comment dit-on « lettre de relance pour facture impayée » en anglais ?", a: "On parle de « payment reminder » ou de « overdue invoice reminder ». Dans le langage courant des entreprises britanniques, on dit aussi « a chaser » ou « a chasing letter ». Une facture impayée se dit « unpaid invoice » ou « overdue invoice », et aux États-Unis « past due invoice »." },
  { q: "Comment dit-on « mise en demeure » en anglais ?", a: "L'équivalent le plus proche est « final demand » ou « formal demand ». Au Royaume-Uni, la lettre qui précède immédiatement une action en justice s'appelle « letter before action » ou « letter before claim ». Évitez « formal notice » seul, trop vague, et « summons », qui désigne une convocation devant un tribunal." },
  { q: "Faut-il écrire en anglais britannique ou américain ?", a: "Adaptez-vous au pays du client. Pour le Royaume-Uni et l'Irlande : date au format « 14 March 2026 », « Yours sincerely », « overdue », « cheque ». Pour les États-Unis : « March 14, 2026 », « Sincerely », « past due », « check ». Les trois modèles de cette page sont en anglais britannique et restent parfaitement compris aux États-Unis." },
  { q: "Puis-je réclamer des pénalités de retard à un client britannique ?", a: "Oui, mais leur montant dépend du droit applicable au contrat. Si vos conditions générales prévoient le droit français, ce sont les pénalités de retard et l'indemnité forfaitaire de 40 € du Code de commerce qui s'appliquent. Si le contrat est soumis au droit anglais, c'est le Late Payment of Commercial Debts (Interest) Act 1998 : 8 points au-dessus du taux de la Banque d'Angleterre, plus une somme forfaitaire de 40, 70 ou 100 £. En cas de doute, faites vérifier vos conditions par un professionnel." },
  { q: "Quel délai de paiement accorder dans une relance en anglais ?", a: "Sept jours pour une relance ferme ou une mise en demeure : c'est l'usage au Royaume-Uni. Indiquez toujours une date précise (« by 14 March ») plutôt qu'un délai (« within 7 days »), afin d'éviter toute discussion sur le point de départ." },
  { q: "Vaut-il mieux envoyer la relance par e-mail ou par courrier ?", a: "Par e-mail pour les deux premières relances : c'est ce qu'attendent les services comptables britanniques. Pour la mise en demeure, doublez l'e-mail d'un courrier postal avec preuve d'envoi, adressé au siège social de la société, que vous pouvez vérifier gratuitement sur le registre Companies House." },
]

// A translation tucked under each English letter: in the HTML for readers
// and crawlers, collapsed so the page is not twice as long.
function Translation({ text }) {
  return (
    <details className={s.calloutGrey} style={{ marginTop: -12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Traduction française de cette lettre</summary>
      <pre className={s.letterBody} style={{ padding: "14px 0 0" }}>{text}</pre>
    </details>
  )
}

export default function LettreRelanceFactureImpayeeAnglais({ onBack, onGetStarted }) {
  const rate = getRate()
  const schema = comparisonSchema({ title: TITLE, lede: LEDE, canonical: CANONICAL, faqs: FAQS, lang: "fr" })
  const copy = { copyLabel: "Copier la lettre", copiedLabel: "Copié", selectedLabel: "Sélectionné : à copier" }

  return (
    <GuideLayout
      title={TITLE}
      lede={LEDE}
      canonicalPath={CANONICAL}
      onBack={onBack}
      onGetStarted={onGetStarted}
      faqs={FAQS}
      schema={schema}
      locale="fr"
      related={[
        { href: "/guides/final-demand-letter-template", title: "Final demand letter template", desc: "La mise en demeure version britannique, avec les intérêts légaux du droit anglais déjà chiffrés." },
        { href: "/guides/overdue-invoice-letter-templates", title: "Overdue invoice letters: 30, 60 and 90 days", desc: "Une lettre pour chaque palier de retard : 30, 60 et 90 jours." },
        { href: "/guides/letter-before-action", title: "Letter Before Action", desc: "La dernière lettre avant une action devant les tribunaux anglais : contenu, délais et envoi." },
      ]}
    >
      <ul className={s.jump}>
        <li><a href="#premiere-relance">Première relance</a></li>
        <li><a href="#relance-ferme">Relance ferme</a></li>
        <li><a href="#mise-en-demeure">Mise en demeure</a></li>
        <li><a href="#vocabulaire">Vocabulaire</a></li>
      </ul>

      <h2>Quel modèle envoyer, et à quel moment</h2>
      <p>
        Une relance en anglais suit la même progression qu'en français : on suppose d'abord un oubli, puis on fixe une date, puis on met en demeure. La différence tient au ton. Un service comptable britannique attend un message court, factuel et poli, sans formule de politesse à rallonge. Voici le calendrier habituel.
      </p>
      <table className={s.timeline}>
        <thead>
          <tr><th>Retard</th><th>Lettre</th><th>Nom anglais</th></tr>
        </thead>
        <tbody>
          <tr><td>1 à 7 jours</td><td>Première relance, courtoise</td><td>Payment reminder</td></tr>
          <tr><td>Environ 14 jours</td><td>Relance ferme, avec une date</td><td>Second reminder</td></tr>
          <tr><td>21 à 30 jours</td><td>Mise en demeure</td><td>Final demand</td></tr>
        </tbody>
      </table>

      <h2>Modèle 1 : première relance en anglais (rappel courtois)</h2>
      <p>
        À envoyer dans la semaine qui suit l'échéance. Le message part du principe que la facture a été oubliée et pose la question qui débloque la plupart des dossiers : vous manque-t-il quelque chose pour la payer ?
      </p>
      <LetterBlock
        id="premiere-relance"
        title="Payment reminder (première relance)"
        text={FIRST_EN}
        lang="en-GB"
        note="Joignez de nouveau la facture en PDF. Remplacez les éléments entre crochets."
        {...copy}
      />
      <Translation text={FIRST_FR} />

      <h2>Modèle 2 : relance ferme en anglais (deuxième rappel)</h2>
      <p>
        À envoyer vers 14 jours de retard, si le premier message est resté sans réponse. Trois choses changent : le nombre de jours de retard est indiqué, une date limite est fixée, et les intérêts de retard sont mentionnés.
      </p>
      <LetterBlock
        id="relance-ferme"
        title="Second reminder (relance ferme)"
        text={SECOND_EN}
        lang="en-GB"
        note="« By return » signifie « par retour de courriel ». La formule est courante et polie."
        {...copy}
      />
      <Translation text={SECOND_FR} />
      <p>
        Vous pouvez préciser le fondement des pénalités en remplaçant la phrase « Please note that… » par l'une des deux suivantes, selon le droit applicable à votre contrat :
      </p>
      <ul>
        <li lang="en-GB"><strong>Droit français :</strong> « Under our terms and conditions, which are governed by French law, late payment interest and a fixed recovery charge of EUR 40 are payable on overdue invoices. »</li>
        <li lang="en-GB"><strong>Droit anglais :</strong> « Under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest at 8% above the Bank of England base rate and a fixed sum for recovery costs are payable on overdue invoices. »</li>
      </ul>

      <h2>Modèle 3 : mise en demeure en anglais (final demand)</h2>
      <p>
        À envoyer lorsque les deux relances ont échoué. La lettre détaille la somme due, fixe une dernière date et annonce la suite. Envoyez-la par courriel et par courrier postal.
      </p>
      <LetterBlock
        id="mise-en-demeure"
        title="Final demand (mise en demeure)"
        text={FINAL_EN}
        lang="en-GB"
        note="N'annoncez une action en justice que si vous êtes prêt à l'engager."
        {...copy}
      />
      <Translation text={FINAL_FR} />

      <h2 id="vocabulaire">Le vocabulaire de la relance en anglais</h2>
      <table className={s.timeline}>
        <thead>
          <tr><th>Français</th><th>Anglais</th></tr>
        </thead>
        <tbody>
          {VOCAB.map(([fr, en]) => (
            <tr key={fr}><td style={{ whiteSpace: "normal" }}>{fr}</td><td lang="en-GB">{en}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Les usages de la correspondance commerciale anglaise</h2>
      <ul>
        <li><strong>La formule d'appel.</strong> « Dear Ms Taylor » ou « Dear Mr Taylor » si vous connaissez le nom, « Dear Sir or Madam » sinon. Entre interlocuteurs qui se connaissent, le prénom est courant : « Dear Sarah ».</li>
        <li><strong>La formule de politesse.</strong> « Yours sincerely » quand la lettre commence par un nom, « Yours faithfully » après « Dear Sir or Madam ». Dans un courriel, « Kind regards » suffit. Il n'existe pas d'équivalent aux longues formules françaises, et il ne faut pas les traduire.</li>
        <li><strong>La date.</strong> « 14 March 2026 » au Royaume-Uni, « March 14, 2026 » aux États-Unis. Évitez « 03/04/2026 », qui ne désigne pas le même jour des deux côtés de l'Atlantique.</li>
        <li><strong>La fermeté par la retenue.</strong> « I would be grateful if you could arrange payment by 14 March » est une demande ferme, pas une supplique. Les majuscules, les points d'exclamation et les reproches passent très mal.</li>
        <li><strong>Les faux amis.</strong> « We are waiting for your payment » sonne sec ; préférez « We look forward to receiving your payment ». « Delay » désigne un retard, pas un délai : un délai de paiement se dit « payment terms » ou « deadline ».</li>
        <li><strong>La concision.</strong> Numéro de facture, montant et échéance dans les deux premières lignes. Une seule demande par message.</li>
      </ul>

      <h2>Pénalités de retard : droit français ou droit anglais ?</h2>
      <p>
        Les sommes que vous pouvez ajouter à une facture en retard dépendent du droit qui régit votre contrat. C'est en général celui que désignent vos conditions générales de vente ou le contrat signé avec le client.
      </p>
      <ul>
        <li><strong>Contrat soumis au droit français.</strong> Le Code de commerce (article L. 441-10) prévoit des pénalités de retard, au taux fixé par vos conditions générales, et une indemnité forfaitaire pour frais de recouvrement de 40 €. Elles sont dues sans qu'un rappel soit nécessaire.</li>
        <li><strong>Contrat soumis au droit anglais.</strong> Le <span lang="en-GB">Late Payment of Commercial Debts (Interest) Act 1998</span> accorde des intérêts légaux de 8 points au-dessus du taux directeur de la Banque d'Angleterre, soit {rate} % par an actuellement, et une somme forfaitaire de 40 £, 70 £ ou 100 £ selon le montant de la facture. Notre <a href="/calculator">calculateur</a> (en anglais) donne le montant exact.</li>
        <li><strong>Aucune clause ?</strong> Entre professionnels, c'est en principe le droit du pays du vendeur ou du prestataire qui s'applique, donc le droit français si votre entreprise est établie en France. Faites confirmer ce point par un professionnel avant de chiffrer des pénalités dans une mise en demeure.</li>
      </ul>
      <div className={s.callout}>
        <p>
          Cette page donne des informations générales et des modèles de lettres. Elle ne remplace pas un conseil juridique adapté à votre contrat.
        </p>
      </div>

      <h2>Si le client ne paie toujours pas</h2>
      <p>
        Lorsque la mise en demeure reste sans effet, l'étape suivante au Royaume-Uni est la <a href="/guides/letter-before-action"><span lang="en-GB">letter before action</span></a>, la lettre que les tribunaux anglais attendent avant toute procédure. Une entreprise étrangère peut ensuite agir devant la justice anglaise. Pour les créances inférieures à 10 000 £, la procédure simplifiée ne nécessite pas d'avocat, mais le dépôt en ligne peut exiger une adresse au Royaume-Uni : vérifiez ce point avant de vous lancer. Notre guide sur la <a href="/guides/small-claims-court-unpaid-invoice"><span lang="en-GB">small claims court</span></a> (en anglais) décrit la marche à suivre.
      </p>
      <p>
        Attention : depuis le Brexit, l'injonction de payer européenne ne s'applique plus aux débiteurs établis au Royaume-Uni. Pour une créance importante, consultez un avocat ou un cabinet de recouvrement habitué aux dossiers franco-britanniques.
      </p>
    </GuideLayout>
  )
}
