# frozen_string_literal: true

module Characters
  # Parser mínimo do `.def` do MUGEN (formato INI): seções `[Nome]`, pares
  # `chave = valor`, comentários com `;`. Chaves e nomes de seção são
  # case-insensitive (normalizados para minúsculas); valores perdem aspas.
  #
  #   DefParser.parse(text)["files"] # => { "cmd" => "kfm.cmd", "st" => "kfm.cns", ... }
  module DefParser
    module_function

    def parse(text)
      sections = {}
      current = nil

      text.to_s.delete_prefix("﻿").each_line do |raw|
        line = raw.sub(/;.*/, "").strip
        next if line.empty?

        if (header = line.match(/\A\[\s*([^\]]+?)\s*\]/))
          current = header[1].downcase.squish
          sections[current] ||= {}
        elsif current && (pair = line.match(/\A([^=]+?)\s*=\s*(.*)\z/))
          sections[current][pair[1].strip.downcase] = unquote(pair[2].strip)
        end
      end

      sections
    end

    def unquote(value)
      value.match?(/\A".*"\z/) ? value[1..-2].strip : value
    end
  end
end
