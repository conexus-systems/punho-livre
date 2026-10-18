# frozen_string_literal: true

module Characters
  # Validação do servidor para packs `mugen-arena-pack/1` (docs/PROTOCOL.md):
  # formato, id, `.def` presente, arquivos referenciados em [Files] presentes,
  # corpo ≤ PACK_MAX_BYTES (padrão 5 MB). Devolve o pack normalizado e o corpo JSON exato que será
  # servido (e cujo sha256 é publicado).
  class PackValidator
    FORMAT = "mugen-arena-pack/1"
    # Packs importados com atlas em data URI podem passar de 5 MB; ajuste por env.
    MAX_BYTES = Integer(ENV.fetch("PACK_MAX_BYTES", (5 * 1024 * 1024).to_s), 10)
    MAX_FILES = 64
    ID_FORMAT = Character::SLUG_FORMAT

    # Chaves de [Files] que precisam existir e apontar para arquivos do pack.
    # `anim` é a chave real do MUGEN para o `.air`; aceitamos também `air`.
    REQUIRED_KEYS = [ "cmd", "cns", %w[anim air] ].freeze
    # Chaves cujo arquivo, se declarado, precisa estar no pack (st, st0..st9, ...).
    # `stcommon` (common1.cns) é fornecido pela engine do app quando ausente.
    REFERENCED_KEY = /\A(cmd|cns|anim|air|st\d*)\z/
    ATLAS_FORMAT = %r{\A(https://\S+|data:image/png;base64,[A-Za-z0-9+/=\s]+)\z}
    FRAME_KEY = /\A-?\d+,\s*-?\d+\z/

    class Invalid < StandardError
      attr_reader :details

      def initialize(details)
        @details = Array(details)
        super(@details.join("; "))
      end
    end

    Result = Data.define(:pack, :body, :sha256, :size_bytes)

    def self.call(pack)
      new(pack).call
    end

    def initialize(pack)
      @pack = pack
      @errors = []
    end

    def call
      raise Invalid, "pack must be a JSON object" unless @pack.is_a?(Hash)

      validate_header
      validate_files
      validate_def_references if @errors.empty?
      validate_sprites
      raise Invalid, @errors if @errors.any?

      body = JSON.generate(@pack)
      raise Invalid, "pack body exceeds #{MAX_BYTES} bytes" if body.bytesize > MAX_BYTES

      Result.new(pack: @pack, body: body, sha256: Digest::SHA256.hexdigest(body), size_bytes: body.bytesize)
    end

    private

    def validate_header
      @errors << "format must be #{FORMAT}" unless @pack["format"] == FORMAT
      @errors << "id must match #{ID_FORMAT.source}" unless @pack["id"].is_a?(String) && @pack["id"].match?(ID_FORMAT)
      string_field("name", max: 64, required: true)
      string_field("version", max: 32, required: true)
      string_field("author", max: 64, required: false)
    end

    def string_field(key, max:, required:)
      value = @pack[key]
      return if value.nil? && !required

      unless value.is_a?(String) && value.strip.present? && value.length <= max
        @errors << "#{key} must be a non-empty string (max #{max} chars)"
      end
    end

    def validate_files
      files = @pack["files"]
      unless files.is_a?(Hash) && files.any?
        @errors << "files must be a non-empty object of { path: text }"
        return
      end

      @errors << "files has more than #{MAX_FILES} entries" if files.size > MAX_FILES
      files.each do |path, content|
        @errors << "file #{path.inspect} has an unsafe path" unless safe_path?(path)
        @errors << "file #{path.inspect} must be a string" unless content.is_a?(String)
      end

      def_name = @pack["def"]
      if !def_name.is_a?(String) || !files.key?(def_name)
        @errors << "def must name a file present in files"
      elsif !def_name.downcase.end_with?(".def")
        @errors << "def must be a .def file"
      end
    end

    def validate_def_references
      entries = DefParser.parse(@pack["files"][@pack["def"]])["files"]
      if entries.nil?
        @errors << "#{@pack['def']} has no [Files] section"
        return
      end

      REQUIRED_KEYS.each do |keys|
        alternatives = Array(keys)
        next if alternatives.any? { |key| entries[key].present? }

        @errors << "[Files] must declare #{alternatives.join(' or ')}"
      end

      entries.each do |key, value|
        next unless key.match?(REFERENCED_KEY) && value.present?
        next if file_present?(value)

        @errors << "[Files] #{key} = #{value} is missing from files"
      end
    end

    def validate_sprites
      sprites = @pack["sprites"]
      return if sprites.nil?

      unless sprites.is_a?(Hash)
        @errors << "sprites must be null or an object"
        return
      end

      @errors << "sprites.atlas must be an https URL or a data:image/png;base64 URI" unless
        sprites["atlas"].is_a?(String) && sprites["atlas"].match?(ATLAS_FORMAT)

      frames = sprites["frames"]
      unless frames.is_a?(Hash)
        @errors << "sprites.frames must be an object"
        return
      end

      bad = frames.find do |key, rect|
        !key.match?(FRAME_KEY) || !rect.is_a?(Array) || rect.size != 6 || !rect.all?(Numeric)
      end
      @errors << "sprites.frames[#{bad.first.inspect}] must be [x, y, w, h, axisX, axisY]" if bad
    end

    # Caminhos do [Files] são relativos ao diretório do .def; comparação
    # case-insensitive e tolerante a "\" (packs vindos do Windows).
    def file_present?(reference)
      def_dir = File.dirname(normalize(@pack["def"]))
      ref = normalize(reference)
      candidates = [ ref ]
      candidates << normalize("#{def_dir}/#{ref}") unless def_dir == "."
      known = @pack["files"].keys.map { |path| normalize(path) }
      candidates.intersect?(known)
    end

    def normalize(path)
      path.to_s.tr("\\", "/").squeeze("/").delete_prefix("./").downcase
    end

    def safe_path?(path)
      path.is_a?(String) && path.present? && path.length <= 128 &&
        !path.start_with?("/", "\\") && path.tr("\\", "/").split("/").none?("..")
    end
  end
end
