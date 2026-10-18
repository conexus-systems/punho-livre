import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

// Assina (esquema v2) e verifica um APK usando a biblioteca apksig.
// A v1 fica de fora: o apksig do Maven Central é antigo e não a gera no Java 17+,
// e ela só é necessária abaixo do Android 7.0 (o minSdk do app é 24).
// Uso: java Sign <entrada.apk> <saida.apk> <keystore.p12> <senha> <alias>
public class Sign {
    public static void main(String[] a) throws Exception {
        char[] pass = a[3].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(a[2])) { ks.load(in, pass); }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[4]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("MUGEN", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
            .setInputApk(new File(a[0]))
            .setOutputApk(new File(a[1]))
            .setMinSdkVersion(24)
            .setV1SigningEnabled(false)
            .setV2SigningEnabled(true)
            .build()
            .sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
        if (!r.isVerified()) {
            System.err.println("Falha na verificação: " + r.getErrors());
            System.exit(1);
        }
        System.out.println("Assinatura verificada (v1=" + r.isVerifiedUsingV1Scheme() + ", v2=" + r.isVerifiedUsingV2Scheme() + ")");
    }
}
