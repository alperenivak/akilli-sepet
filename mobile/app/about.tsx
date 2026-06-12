// =====================================================
// Akıllı Sepet - Hakkında Ekranı
// Uygulama bilgileri · Yasal bildirimler · KVKK
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../src/utils/constants';

const APP_VERSION  = '1.0.0';
const BUILD_NUMBER = '100';
const COMPANY_NAME = 'Akıllı Sepet Yazılım A.Ş.';
const YEAR         = new Date().getFullYear();

// ── Açılıp kapanan bölüm ─────────────────────────────
function Accordion({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={a.wrap}>
      <TouchableOpacity style={a.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={a.iconBox}>
          <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={a.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
      </TouchableOpacity>
      {open && <View style={a.body}>{children}</View>}
    </View>
  );
}

// ── Link satırı ──────────────────────────────────────
function LinkRow({ icon, label, url, color = COLORS.primary }: { icon: string; label: string; url: string; color?: string }) {
  return (
    <TouchableOpacity style={lr.row} onPress={() => Linking.openURL(url)} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[lr.txt, { color }]}>{label}</Text>
      <Ionicons name="open-outline" size={13} color="#94a3b8" />
    </TouchableOpacity>
  );
}

// ── Ana Ekran ────────────────────────────────────────
export default function AboutScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Üst Bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Hakkında</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Marka Alanı ── */}
        <View style={s.brand}>
          <View style={s.logoBox}>
            <Ionicons name="cart" size={36} color="#fff" />
          </View>
          <Text style={s.appName}>Akıllı Sepet</Text>
          <Text style={s.tagline}>Akıllı alışverişin adresi</Text>
          <View style={s.versionRow}>
            <View style={s.vBadge}>
              <Text style={s.vBadgeTxt}>v{APP_VERSION}</Text>
            </View>
            <View style={s.vBadge}>
              <Text style={s.vBadgeTxt}>Build {BUILD_NUMBER}</Text>
            </View>
            <View style={s.vBadge}>
              <Text style={s.vBadgeTxt}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
            </View>
          </View>
        </View>

        {/* ── Uygulama Açıklaması ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Uygulama Hakkında</Text>
          <Text style={s.cardTxt}>
            Akıllı Sepet, Türkiye genelindeki marketlerin güncel fiyatlarını anlık olarak karşılaştırmanıza,
            son kullanma tarihi geçmiş veya yaklaşan ürünleri topluluk tabanlı sistemle bildirmenize ve
            yapay zeka destekli alışveriş önerileri almanıza olanak tanıyan bir tüketici bilgi platformudur.
          </Text>
          <Text style={[s.cardTxt, { marginTop: 10 }]}>
            Uygulama, gerçek zamanlı veri güncelleme, barkod tarama, market şube konumu ve navigasyon,
            aktüel katalog takibi gibi özellikler sunmaktadır.
          </Text>
        </View>

        {/* ── İletişim ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>İletişim</Text>
          <LinkRow icon="mail-outline"      label="destek@Akıllı Sepet.com.tr"   url="mailto:destek@Akıllı Sepet.com.tr" />
          <LinkRow icon="globe-outline"     label="www.Akıllı Sepet.com.tr"      url="https://www.Akıllı Sepet.com.tr" />
          <LinkRow icon="logo-linkedin"     label="LinkedIn"                  url="https://linkedin.com/company/Akıllı Sepet" color="#0a66c2" />
          <LinkRow icon="logo-instagram"    label="@Akıllı Sepet.tr"             url="https://instagram.com/Akıllı Sepet.tr"     color="#e1306c" />
        </View>

        {/* ── Yasal Bilgiler (Accordion'lar) ── */}

        <Accordion title="Kullanım Koşulları" icon="document-text-outline">
          <Text style={t.p}>
            Bu uygulamayı ("Akıllı Sepet") indirerek veya kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.
            Koşulları kabul etmiyorsanız uygulamayı kullanmayınız.
          </Text>
          <Text style={t.h}>1. Hizmetin Amacı</Text>
          <Text style={t.p}>
            Akıllı Sepet yalnızca bilgilendirme amacıyla hazırlanmıştır. Ürün fiyatları, stok durumu ve içerik
            üçüncü taraf kaynaklardan derlenmekte olup {COMPANY_NAME} bu bilgilerin doğruluğunu,
            eksiksizliğini veya güncelliğini garanti etmez.
          </Text>
          <Text style={t.h}>2. Kullanıcı Yükümlülükleri</Text>
          <Text style={t.p}>
            Kullanıcılar, uygulamayı yalnızca yasal amaçlarla ve bu koşullara uygun biçimde kullanmayı
            kabul eder. Sistemi kötüye kullanmak, gerçeğe aykırı ihbar oluşturmak, başkalarının haklarını
            ihlal etmek kesinlikle yasaktır. İhlal durumunda hesap askıya alınabilir veya yasal işlem başlatılabilir.
          </Text>
          <Text style={t.h}>3. Fikri Mülkiyet</Text>
          <Text style={t.p}>
            Uygulamada yer alan tüm içerikler, görseller, kodlar ve materyaller {COMPANY_NAME} veya
            lisans vericilerinin mülkiyetindedir. İzinsiz kopyalanması, dağıtılması veya değiştirilmesi yasaktır.
          </Text>
          <Text style={t.h}>4. Sorumluluk Reddi</Text>
          <Text style={t.p}>
            {COMPANY_NAME}, uygulama aracılığıyla gerçekleştirilen alışverişlerden, fiyat farklarından
            veya kullanıcı kaynaklı içeriklerden doğabilecek zararlardan sorumlu tutulamaz.
          </Text>
          <Text style={t.h}>5. Hizmet Değişiklikleri</Text>
          <Text style={t.p}>
            {COMPANY_NAME}, önceden bildirim yapmaksızın hizmetin tamamını veya bir bölümünü geçici ya da
            kalıcı olarak değiştirme, askıya alma veya sonlandırma hakkını saklı tutar.
          </Text>
          <Text style={t.h}>6. Yürürlük ve Yetki</Text>
          <Text style={t.p}>
            Bu koşullar Türk Hukuku'na tâbidir. Anlaşmazlıklarda İstanbul Merkez Mahkemeleri ve İcra Daireleri
            yetkilidir. Son güncelleme: {YEAR}.
          </Text>
        </Accordion>

        <Accordion title="Gizlilik Politikası" icon="shield-checkmark-outline">
          <Text style={t.p}>
            {COMPANY_NAME} olarak kullanıcılarımızın gizliliğine saygı duyuyor ve kişisel verilerinizi
            korumayı en temel sorumluluklarımızdan biri kabul ediyoruz.
          </Text>
          <Text style={t.h}>Toplanan Veriler</Text>
          <Text style={t.p}>
            • Ad, soyad, e-posta, telefon numarası (kayıt sırasında){'\n'}
            • Cihaz bilgileri (model, işletim sistemi, uygulama versiyonu){'\n'}
            • Konum bilgisi (yalnızca market/şube arama veya ihbar oluşturma sırasında, açık rızayla){'\n'}
            • Uygulama kullanım istatistikleri (anonim){'\n'}
            • İhbar içerikleri ve yüklenen görseller
          </Text>
          <Text style={t.h}>Verilerin Kullanımı</Text>
          <Text style={t.p}>
            Toplanan veriler; hizmetin sunulması, güvenliğin sağlanması, yasal yükümlülüklerin yerine
            getirilmesi ve hizmet kalitesinin artırılması amacıyla kullanılır. Verileriniz asla
            üçüncü taraflara satılmaz veya kiralanmaz.
          </Text>
          <Text style={t.h}>Veri Güvenliği</Text>
          <Text style={t.p}>
            Verileriniz AES-256 şifreleme ile korunmakta, sunucularımız ISO/IEC 27001 sertifikalı
            veri merkezlerinde barındırılmaktadır. Şifreler bcrypt algoritması ile hashlenmekte,
            açık metin olarak asla saklanmamaktadır.
          </Text>
          <Text style={t.h}>Veri Saklama Süresi</Text>
          <Text style={t.p}>
            Hesabınızı sildiğinizde verileriniz 30 gün içinde silinir. Yasal yükümlülükler
            gerektirdiği durumlarda ilgili mevzuat süresi kadar saklanır.
          </Text>
        </Accordion>

        <Accordion title="KVKK Aydınlatma Metni" icon="person-circle-outline">
          <Text style={t.h}>Veri Sorumlusu</Text>
          <Text style={t.p}>
            {COMPANY_NAME} — 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında
            "veri sorumlusu" sıfatıyla hareket etmektedir.
          </Text>
          <Text style={t.h}>Kişisel Verilerin İşlenme Amacı</Text>
          <Text style={t.p}>
            Kişisel verileriniz; sözleşmenin kurulması ve ifası (KVKK m.5/2-c), meşru menfaat
            (KVKK m.5/2-f) ve açık rıza (KVKK m.5/1) hukuki sebeplerine dayanılarak işlenmektedir.
          </Text>
          <Text style={t.h}>Haklarınız (KVKK Madde 11)</Text>
          <Text style={t.p}>
            • Kişisel verilerinizin işlenip işlenmediğini öğrenme{'\n'}
            • İşlenmişse buna ilişkin bilgi talep etme{'\n'}
            • İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme{'\n'}
            • Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme{'\n'}
            • Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme{'\n'}
            • Silinmesini veya yok edilmesini talep etme{'\n'}
            • Otomatik sistemler vasıtasıyla aleyhinize sonuç doğuran kararlara itiraz etme
          </Text>
          <Text style={t.h}>Başvuru Yolu</Text>
          <Text style={t.p}>
            KVKK kapsamındaki haklarınızı kullanmak için kvkk@Akıllı Sepet.com.tr adresine
            yazılı olarak başvurabilirsiniz. Başvurular 30 gün içinde yanıtlanır.
          </Text>
        </Accordion>

        <Accordion title="Açık Kaynak Lisansları" icon="code-slash-outline">
          <Text style={t.p}>Bu uygulama aşağıdaki açık kaynaklı yazılımları kullanmaktadır:</Text>
          {[
            { name: 'React Native',        license: 'MIT',      owner: 'Meta Platforms, Inc.' },
            { name: 'Expo',                license: 'MIT',      owner: 'Expo, Inc.' },
            { name: 'NestJS',              license: 'MIT',      owner: 'Kamil Myśliwiec' },
            { name: 'Prisma ORM',          license: 'Apache 2.0', owner: 'Prisma Data, Inc.' },
            { name: 'PostgreSQL',          license: 'PostgreSQL', owner: 'The PostgreSQL Global Dev. Group' },
            { name: 'Redis',               license: 'BSD-3',    owner: 'Redis Ltd.' },
            { name: 'MinIO',               license: 'AGPL-3.0', owner: 'MinIO, Inc.' },
            { name: 'Zustand',             license: 'MIT',      owner: 'pmndrs' },
            { name: 'React Query',         license: 'MIT',      owner: 'TanStack' },
            { name: '@expo-google-fonts',  license: 'OFL-1.1',  owner: 'Google LLC' },
            { name: 'Ionicons',            license: 'MIT',      owner: 'Ionic Team' },
            { name: 'Axios',               license: 'MIT',      owner: 'Matt Zabriskie' },
            { name: 'BullMQ',              license: 'MIT',      owner: 'Taskforce.sh, Inc.' },
          ].map((lib) => (
            <View key={lib.name} style={t.libRow}>
              <Text style={t.libName}>{lib.name}</Text>
              <View style={t.licBadge}>
                <Text style={t.licBadgeTxt}>{lib.license}</Text>
              </View>
              <Text style={t.libOwner}>{lib.owner}</Text>
            </View>
          ))}
          <Text style={[t.p, { marginTop: 10, fontStyle: 'italic' }]}>
            Lisans metinlerinin tamamı uygulama paketinde LICENSES.txt dosyasında yer almaktadır.
          </Text>
        </Accordion>

        <Accordion title="Çerez ve İzleme Politikası" icon="eye-off-outline">
          <Text style={t.p}>
            Akıllı Sepet web versiyonu dışında çerez (cookie) kullanmaz. Mobil uygulamada yalnızca
            güvenli depolama (expo-secure-store) ile JWT token'ları saklanır; bu veriler cihazdan
            ayrılmaz ve hiçbir izleme/reklam ağıyla paylaşılmaz.
          </Text>
          <Text style={t.h}>Üçüncü Taraf SDK'ları</Text>
          <Text style={t.p}>
            Uygulama push bildirimleri için Firebase Cloud Messaging kullanmaktadır.
            Firebase'in kendi gizlilik politikası geçerlidir: policies.google.com/privacy
          </Text>
        </Accordion>

        {/* ── Telif Hakkı ── */}
        <View style={s.copyright}>
          <Ionicons name="shield-half-outline" size={18} color={COLORS.primary} />
          <Text style={s.copyrightTxt}>
            © {YEAR} {COMPANY_NAME}{'\n'}
            Tüm hakları saklıdır. "Akıllı Sepet" ve ürün adları{'\n'}
            {COMPANY_NAME} tescilli ticari markalarıdır.
          </Text>
        </View>

        <Text style={s.legal}>
          Bu uygulama 6698 Sayılı KVKK, 6563 Sayılı Elektronik Ticaret Kanunu ve{'\n'}
          5651 Sayılı İnternet Kanunu kapsamında faaliyet göstermektedir.{'\n'}
          Türkiye Cumhuriyeti yasalarına tabidir.
        </Text>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stiller ────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { gap: 10, padding: 16 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },

  brand: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  logoBox: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  appName:   { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  tagline:   { fontSize: 14, color: '#64748b' },
  versionRow:{ flexDirection: 'row', gap: 8, marginTop: 4 },
  vBadge:    { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  vBadgeTxt: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  cardTxt:   { fontSize: 13, color: '#475569', lineHeight: 20 },

  copyright: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  copyrightTxt: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 20, fontWeight: '600' },

  legal: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 18,
    paddingHorizontal: 8,
  },
});

// Accordion stilleri
const a = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  iconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  body:  { paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
});

// Text içi stiller
const t = StyleSheet.create({
  h: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 10 },
  p: { fontSize: 13, color: '#475569', lineHeight: 20 },
  libRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  libName:    { fontSize: 12, fontWeight: '700', color: '#0f172a', flex: 1 },
  licBadge:   { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  licBadgeTxt:{ fontSize: 10, color: '#64748b', fontWeight: '600' },
  libOwner:   { fontSize: 11, color: '#94a3b8', flex: 2, textAlign: 'right' },
});

// LinkRow stilleri
const lr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  txt: { flex: 1, fontSize: 13, fontWeight: '600' },
});
