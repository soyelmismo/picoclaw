# ============================================================
# Picoclaw — headless runtime image (sin binario)
# El binario se monta como volumen en tiempo de ejecución.
# ============================================================
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D picoclaw

USER picoclaw
ENTRYPOINT ["/usr/local/bin/picoclaw"]
CMD ["gateway"]
