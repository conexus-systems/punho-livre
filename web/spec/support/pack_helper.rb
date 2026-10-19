# frozen_string_literal: true

# Pack mínimo válido no formato mugen-arena-pack/1.
module PackHelper
  def build_pack(id: "kaze", **overrides)
    {
      "format" => "mugen-arena-pack/1",
      "id" => id,
      "name" => id.capitalize,
      "author" => "Fulano",
      "version" => "1.0.0",
      "def" => "#{id}.def",
      "files" => {
        "#{id}.def" => <<~DEF,
          ; Definição do personagem
          [Info]
          name = "#{id.capitalize}"
          [Files]
          CMD     = #{id}.cmd   ; comandos
          Cns     = #{id}.cns
          st      = #{id}.cns
          stcommon = common1.cns
          anim    = #{id}.air
          sprite  = #{id}.sff
        DEF
        "#{id}.cmd" => "[Command]\nname = \"a\"\ncommand = a\n",
        "#{id}.cns" => "[Data]\nlife = 1000\n",
        "#{id}.air" => "[Begin Action 0]\n0,0, 0,0, 10\n"
      },
      "sprites" => nil
    }.merge(overrides)
  end
end

RSpec.configure { |config| config.include PackHelper }
