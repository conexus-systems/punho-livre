# Botão/gesto voltar no Android 13+ (OnBackInvokedCallback). No Android 16 com
# targetSdk 36 o onBackPressed() deixa de ser chamado, então o callback é obrigatório.

.class final Lcom/conexus/punholivre/MainActivity$Back;
.super Ljava/lang/Object;
.implements Landroid/window/OnBackInvokedCallback;

.field final a:Lcom/conexus/punholivre/MainActivity;

.method constructor <init>(Lcom/conexus/punholivre/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/conexus/punholivre/MainActivity$Back;->a:Lcom/conexus/punholivre/MainActivity;
    return-void
.end method

.method public onBackInvoked()V
    .registers 2
    iget-object v0, p0, Lcom/conexus/punholivre/MainActivity$Back;->a:Lcom/conexus/punholivre/MainActivity;
    invoke-virtual {v0}, Lcom/conexus/punholivre/MainActivity;->onBackPressed()V
    return-void
.end method
